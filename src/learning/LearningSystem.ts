import { randomUUID } from 'node:crypto';
import type {
  IEvidenceStore,
  ILearnedKnowledgeStore,
  ILearningSystem,
} from './interfaces.js';
import { LearningEligibilityPolicy } from './LearningEligibilityPolicy.js';
import {
  LearningResultStatus,
  type LearnedRule,
  type LearningEvidence,
  type LearningResult,
  type LearningSignal,
  type UserFeedback,
} from './types.js';

/** Thrown when a learning-system operation is invalid. */
export class LearningSystemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LearningSystemError';
  }
}

/**
 * Deterministic orchestrator for the signal -> eligibility -> evidence ->
 * rule pipeline (ARCH-0046-02 + ARCH-0046-03).
 *
 * It creates transient LearningEvidence for eligible explicit signals and
 * promotes only Instruction/Correction/Preference to a LearnedRule. Confidence
 * is intentionally omitted: no numerical confidence policy is implemented here
 * (see ARCH-0046-03). A LearnedRule is created based on eligibility, scope, and
 * evidence alone; confidence remains deferred/undetermined.
 *
 * Scope is always preserved and never widened. This system NEVER creates
 * authorization, permissions, or security policy, and never modifies Prompt,
 * Planner, Agent, Memory, ToolAuthorizationEngine, or SessionManager.
 */
export class LearningSystem implements ILearningSystem {
  private readonly evidenceStore: IEvidenceStore;
  private readonly knowledgeStore: ILearnedKnowledgeStore;
  private readonly policy: LearningEligibilityPolicy;

  constructor(
    evidenceStore: IEvidenceStore,
    knowledgeStore: ILearnedKnowledgeStore,
    policy: LearningEligibilityPolicy,
  ) {
    this.evidenceStore = evidenceStore;
    this.knowledgeStore = knowledgeStore;
    this.policy = policy;
  }

  public async processFeedback(feedback: UserFeedback): Promise<LearningResult> {
    // Signal creation is the responsibility of the SemanticFeedbackProcessor.
    // Reaching here without a signal means no learning candidate was produced.
    return {
      status: LearningResultStatus.Ignored,
      feedbackId: feedback.feedbackId,
      processedAt: Date.now(),
      reason: 'No signal was produced from this feedback.',
    };
  }

  public async processSignal(signal: LearningSignal): Promise<LearningResult> {
    const processedAt = Date.now();

    // 1. Eligibility gate (deterministic, independent of any confidence value).
    if (!this.policy.isEligible(signal.feedbackType)) {
      return {
        status: LearningResultStatus.Ignored,
        feedbackId: signal.sourceFeedbackId,
        signalId: signal.signalId,
        processedAt,
        reason: 'Feedback type is not rule-eligible.',
      };
    }

    // 2. Create and store transient evidence (scoped exactly like the signal).
    const candidate = this.policy.normalize(signal.candidate);
    const evidence: LearningEvidence = Object.freeze({
      evidenceId: `evidence-${randomUUID()}`,
      sourceFeedbackId: signal.sourceFeedbackId,
      signalId: signal.signalId,
      feedbackType: signal.feedbackType,
      candidate,
      scope: signal.scope,
      context: Object.freeze({ ...signal.context }),
      createdAt: signal.createdAt,
    });
    await this.evidenceStore.store(evidence);

    // 3. If an equivalent rule already exists in the same scope, the evidence is
    //    recorded as additional support but the rule is not duplicated. No
    //    numeric confidence is computed or escalated; confidence is deferred.
    const existingRules = await this.knowledgeStore.getRules(signal.scope, signal.context);
    const existing = existingRules.find((r) => r.rule === candidate);

    if (existing) {
      return {
        status: LearningResultStatus.Accepted,
        feedbackId: signal.sourceFeedbackId,
        signalId: signal.signalId,
        learnedRule: existing,
        processedAt,
        reason: 'Consistent evidence already represented by an existing rule.',
      };
    }

    // 4. Otherwise create and store a new rule (scope preserved, confidence
    //    intentionally omitted per ARCH-0046-03).
    const rule: LearnedRule = this.freezeRule({
      ruleId: `rule-${randomUUID()}`,
      rule: candidate,
      scope: signal.scope,
      context: Object.freeze({ ...signal.context }),
      sourceFeedbackId: signal.sourceFeedbackId,
      createdAt: processedAt,
    });
    const stored = await this.knowledgeStore.store(rule);

    return {
      status: LearningResultStatus.Accepted,
      feedbackId: signal.sourceFeedbackId,
      signalId: signal.signalId,
      learnedRule: stored,
      processedAt,
    };
  }

  private freezeRule(rule: LearnedRule): LearnedRule {
    return Object.freeze({
      ...rule,
      context: Object.freeze({ ...rule.context }),
    });
  }
}

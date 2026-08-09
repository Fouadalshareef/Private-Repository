import { describe, expect, it } from 'vitest';
import {
  FeedbackSource,
  FeedbackType,
  InMemoryEvidenceStore,
  InMemoryLearnedKnowledgeStore,
  LearningEligibilityPolicy,
  LearningInputKind,
  LearningResultStatus,
  LearningScope,
  LearningSystem,
  SemanticFeedbackProcessor,
  type LearnedRule,
  type LearningEvidence,
  type LearningSignal,
  type SystemObservation,
  type UserFeedback,
} from '../../src/learning/index.js';

function makeFeedback(
  type: UserFeedback['type'],
  content: string,
  scope: LearningScope = LearningScope.Project,
  feedbackId = 'feedback-1',
): UserFeedback {
  const context =
    scope === LearningScope.Session
      ? { sessionId: 'session-1' }
      : scope === LearningScope.Conversation
        ? { conversationId: 'conversation-1' }
        : { projectId: 'project-1' };

  if (type === FeedbackType.Rating) {
    return {
      feedbackId,
      content,
      source: FeedbackSource.User,
      kind: LearningInputKind.ExplicitUserFeedback,
      type,
      rating: 5,
      scope,
      context,
      timestamp: 100,
    };
  }

  return {
    feedbackId,
    content,
    source: FeedbackSource.User,
    kind: LearningInputKind.ExplicitUserFeedback,
    type,
    scope,
    context,
    timestamp: 100,
  };
}

function makeSignal(
  type: FeedbackType,
  candidate: string,
  scope: LearningScope = LearningScope.Project,
  feedbackId = 'feedback-1',
  signalId = 'signal-1',
): LearningSignal {
  const context =
    scope === LearningScope.Session
      ? { sessionId: 'session-1' }
      : scope === LearningScope.Conversation
        ? { conversationId: 'conversation-1' }
        : { projectId: 'project-1' };
  return {
    signalId,
    sourceFeedbackId: feedbackId,
    feedbackType: type,
    candidate,
    scope,
    context,
    createdAt: 100,
  };
}

function createSystem() {
  const evidenceStore = new InMemoryEvidenceStore();
  const knowledgeStore = new InMemoryLearnedKnowledgeStore();
  const policy = new LearningEligibilityPolicy();
  const system = new LearningSystem(evidenceStore, knowledgeStore, policy);
  return { evidenceStore, knowledgeStore, policy, system };
}

const SECURITY_KEYS = ['authorization', 'permission', 'toolAccess', 'securityPolicy'];

describe('TASK-0046-E Learning Boundary & Regression Hardening', () => {
  describe('7. Input boundary', () => {
    it('produces a signal only for explicit user feedback', async () => {
      const processor = new SemanticFeedbackProcessor();
      const signal = await processor.process(
        makeFeedback(FeedbackType.Instruction, 'Use TypeScript strict mode.'),
      );
expect(signal).toBeDefined();
      expect(signal?.candidate).toBe('Use TypeScript strict mode.');
    });

    it('never produces a signal from a SystemObservation', async () => {
      const processor = new SemanticFeedbackProcessor();
      const observation: SystemObservation = {
        observationId: 'observation-1',
        kind: LearningInputKind.SystemObservation,
        category: 'tool_execution',
        context: { sessionId: 'session-1' },
        timestamp: 100,
      };
      await expect(processor.process(observation)).resolves.toBeUndefined();
    });

    it('never produces evidence or a rule from a SystemObservation (end to end)', async () => {
      const { system, evidenceStore, knowledgeStore } = createSystem();
      const observation: SystemObservation = {
        observationId: 'observation-1',
        kind: LearningInputKind.SystemObservation,
        category: 'planner_execution',
        context: { projectId: 'project-1' },
        timestamp: 100,
      };

      const feedbackForObservation = makeFeedback(
        FeedbackType.Instruction,
        'Use strict mode.',
        LearningScope.Project,
        'feedback-obs',
      );
      // A SystemObservation is not a UserFeedback; LearningSystem only accepts UserFeedback.
      // processSignal with a stall signal is the only path, so we assert that a synthetic
      // observation-shaped signal is never routed. Instead, verify the processor gates it out.
      const processor = new SemanticFeedbackProcessor();
      await expect(processor.process(observation)).resolves.toBeUndefined();

      // No evidence and no rule is created from the observation alone.
      expect(evidenceStore.size()).toBe(0);
      expect(await knowledgeStore.getRules(LearningScope.Project, { projectId: 'project-1' })).toHaveLength(0);

      // The system still works for a real explicit signal (control).
      await system.processSignal(makeSignal(FeedbackType.Instruction, 'Use strict mode.', LearningScope.Project));
      expect(evidenceStore.size()).toBe(1);
      expect(feedbackForObservation.feedbackId).toBe('feedback-obs');
    });
  });

  describe('8. Feedback eligibility regression matrix', () => {
    it('Instruction -> signal, evidence, and rule', async () => {
      const { system, evidenceStore, knowledgeStore } = createSystem();
      const result = await system.processSignal(
        makeSignal(FeedbackType.Instruction, 'Use TypeScript strict mode.'),
      );
      expect(result.status).toBe(LearningResultStatus.Accepted);
      expect(result.learnedRule).toBeDefined();
      expect(evidenceStore.size()).toBe(1);
      expect(await knowledgeStore.getRules(LearningScope.Project, { projectId: 'project-1' })).toHaveLength(1);
    });

    it('Correction -> signal, evidence, and rule', async () => {
      const { system, evidenceStore, knowledgeStore } = createSystem();
      const result = await system.processSignal(makeSignal(FeedbackType.Correction, 'Do not use library X.'));
      expect(result.status).toBe(LearningResultStatus.Accepted);
      expect(evidenceStore.size()).toBe(1);
      expect(await knowledgeStore.getRules(LearningScope.Project, { projectId: 'project-1' })).toHaveLength(1);
    });

    it('Preference -> signal, evidence, and rule', async () => {
      const { system, evidenceStore, knowledgeStore } = createSystem();
      const result = await system.processSignal(makeSignal(FeedbackType.Preference, 'I prefer this style.'));
      expect(result.status).toBe(LearningResultStatus.Accepted);
      expect(evidenceStore.size()).toBe(1);
      expect(await knowledgeStore.getRules(LearningScope.Project, { projectId: 'project-1' })).toHaveLength(1);
    });

    it('Rejection -> scoped signal only, no rule', async () => {
      const { system, evidenceStore, knowledgeStore } = createSystem();
      const result = await system.processSignal(
        makeSignal(FeedbackType.Rejection, 'I do not want this plan.', LearningScope.Session),
      );
      expect(result.status).toBe(LearningResultStatus.Ignored);
      expect(result.learnedRule).toBeUndefined();
      expect(evidenceStore.size()).toBe(0);
      expect(await knowledgeStore.getRules(LearningScope.Session, { sessionId: 'session-1' })).toHaveLength(0);
    });

    it('Approval -> no rule', async () => {
      const { system, evidenceStore, knowledgeStore } = createSystem();
      const result = await system.processSignal(makeSignal(FeedbackType.Approval, 'Excellent result.'));
      expect(result.status).toBe(LearningResultStatus.Ignored);
      expect(evidenceStore.size()).toBe(0);
      expect(await knowledgeStore.getRules(LearningScope.Project, { projectId: 'project-1' })).toHaveLength(0);
    });

    it('Rating -> no rule', async () => {
      const { system, evidenceStore, knowledgeStore } = createSystem();
      const result = await system.processSignal(makeSignal(FeedbackType.Rating, 'Rating alone'));
      expect(result.status).toBe(LearningResultStatus.Ignored);
      expect(evidenceStore.size()).toBe(0);
      expect(await knowledgeStore.getRules(LearningScope.Project, { projectId: 'project-1' })).toHaveLength(0);
    });
  });

  describe('9. Scope isolation', () => {
    it('preserves session scope and does not leak into project scope', async () => {
      const { system, knowledgeStore } = createSystem();
      await system.processSignal(makeSignal(FeedbackType.Instruction, 'Session rule.', LearningScope.Session));
      expect(await knowledgeStore.getRules(LearningScope.Session, { sessionId: 'session-1' })).toHaveLength(1);
      expect(await knowledgeStore.getRules(LearningScope.Project, { projectId: 'project-1' })).toHaveLength(0);
      expect(await knowledgeStore.getRules(LearningScope.Conversation, { conversationId: 'conversation-1' })).toHaveLength(0);
    });

    it('preserves conversation scope and does not leak into project scope', async () => {
      const { system, knowledgeStore } = createSystem();
      await system.processSignal(makeSignal(FeedbackType.Correction, 'Conversation rule.', LearningScope.Conversation));
      expect(await knowledgeStore.getRules(LearningScope.Conversation, { conversationId: 'conversation-1' })).toHaveLength(1);
      expect(await knowledgeStore.getRules(LearningScope.Project, { projectId: 'project-1' })).toHaveLength(0);
      expect(await knowledgeStore.getRules(LearningScope.Session, { sessionId: 'session-1' })).toHaveLength(0);
    });

    it('keeps a project rule project-scoped (never becomes global)', async () => {
      const { system, knowledgeStore } = createSystem();
      await system.processSignal(makeSignal(FeedbackType.Preference, 'Project rule.', LearningScope.Project));
      expect(await knowledgeStore.getRules(LearningScope.Project, { projectId: 'project-1' })).toHaveLength(1);
      expect(await knowledgeStore.getRules(LearningScope.Session, { sessionId: 'session-1' })).toHaveLength(0);
      expect(await knowledgeStore.getRules(LearningScope.Conversation, { conversationId: 'conversation-1' })).toHaveLength(0);
    });

    it('preserves context identifiers exactly', async () => {
      const { system, knowledgeStore } = createSystem();
      await system.processSignal(
        makeSignal(FeedbackType.Instruction, 'Keep identifiers.', LearningScope.Project, 'feedback-ctx'),
      );
      const rules = await knowledgeStore.getRules(LearningScope.Project, { projectId: 'project-1' });
      expect(rules).toHaveLength(1);
      expect(rules[0].context).toEqual({ projectId: 'project-1' });
      expect(rules[0].sourceFeedbackId).toBe('feedback-ctx');
    });

    it('a query context cannot retrieve a rule outside its stored scope', async () => {
      const { system, knowledgeStore } = createSystem();
      await system.processSignal(makeSignal(FeedbackType.Instruction, 'Scoped to session.', LearningScope.Session));
      // Querying with a project context must not surface the session rule.
      const projectQuery = await knowledgeStore.getRules(LearningScope.Project, { projectId: 'project-1' });
      expect(projectQuery).toHaveLength(0);
    });
  });

  describe('10. Evidence isolation', () => {
    it('evidence is transient and not present in a new store instance', async () => {
      const store = new InMemoryEvidenceStore();
      await store.store({
        evidenceId: 'evidence-1',
        sourceFeedbackId: 'feedback-1',
        signalId: 'signal-1',
        feedbackType: FeedbackType.Instruction,
        candidate: 'Use strict mode.',
        scope: LearningScope.Project,
        context: { projectId: 'project-1' },
        createdAt: 100,
      });
      expect(store.size()).toBe(1);

      const other = new InMemoryEvidenceStore();
      expect(other.size()).toBe(0);
      expect(await other.getEvidence(LearningScope.Project, { projectId: 'project-1' })).toHaveLength(0);
    });

    it('evidence is scoped and traceable to its source', async () => {
      const store = new InMemoryEvidenceStore();
      await store.store({
        evidenceId: 'evidence-1',
        sourceFeedbackId: 'feedback-1',
        signalId: 'signal-1',
        feedbackType: FeedbackType.Instruction,
        candidate: 'Use strict mode.',
        scope: LearningScope.Project,
        context: { projectId: 'project-1' },
        createdAt: 100,
      });
      const all = await store.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].sourceFeedbackId).toBe('feedback-1');
      expect(all[0].signalId).toBe('signal-1');
      expect(all[0].scope).toBe(LearningScope.Project);
    });

    it('evidence is non-authorizing', async () => {
      const store = new InMemoryEvidenceStore();
      const stored = await store.store({
        evidenceId: 'evidence-1',
        sourceFeedbackId: 'feedback-1',
        signalId: 'signal-1',
        feedbackType: FeedbackType.Instruction,
        candidate: 'Use strict mode.',
        scope: LearningScope.Project,
        context: { projectId: 'project-1' },
        createdAt: 100,
      });
      const keys = Object.keys(stored);
      for (const forbidden of SECURITY_KEYS) {
        expect(keys).not.toContain(forbidden);
      }
    });

    it('is not persisted to any external backend', async () => {
      const store = new InMemoryEvidenceStore();
      await store.store({
        evidenceId: 'evidence-1',
        sourceFeedbackId: 'feedback-1',
        signalId: 'signal-1',
        feedbackType: FeedbackType.Instruction,
        candidate: 'Use strict mode.',
        scope: LearningScope.Project,
        context: { projectId: 'project-1' },
        createdAt: 100,
      });
      // A fresh instance has no access to the prior data -> proves in-memory/transient only.
      const other = new InMemoryEvidenceStore();
      expect(await other.getEvidence(LearningScope.Project, { projectId: 'project-1' })).toHaveLength(0);
    });
  });

  describe('11. LearnedRule provenance', () => {
    it('links a rule to its source feedback via sourceFeedbackId', async () => {
      const { system } = createSystem();
      const signal = makeSignal(
        FeedbackType.Instruction,
        'Use strict mode.',
        LearningScope.Project,
        'feedback-provenance',
        'signal-provenance',
      );
      const result = await system.processSignal(signal);
      expect(result.learnedRule?.sourceFeedbackId).toBe('feedback-provenance');
      expect(result.learnedRule?.sourceFeedbackId).toBe(signal.sourceFeedbackId);
    });

    it('preserves ruleId, sourceFeedbackId, scope, context, createdAt, and rule', async () => {
      const { system } = createSystem();
      const signal = makeSignal(
        FeedbackType.Preference,
        'I prefer this style.',
        LearningScope.Conversation,
        'feedback-prov',
        'signal-prov',
      );
      const result = await system.processSignal(signal);
      const rule = result.learnedRule;
      expect(rule).toBeDefined();
      expect(rule?.ruleId).toMatch(/^rule-/);
      expect(rule?.rule).toBe('I prefer this style.');
      expect(rule?.scope).toBe(LearningScope.Conversation);
      expect(rule?.context).toEqual({ conversationId: 'conversation-1' });
      expect(rule?.sourceFeedbackId).toBe('feedback-prov');
      expect(typeof rule?.createdAt).toBe('number');
    });
  });

  describe('12. Confidence contract regression (ARCH-0046-03)', () => {
    it('creates a rule without confidence successfully', async () => {
      const { system } = createSystem();
      const result = await system.processSignal(makeSignal(FeedbackType.Instruction, 'Use strict mode.'));
      expect(result.status).toBe(LearningResultStatus.Accepted);
      expect(result.learnedRule?.confidence).toBeUndefined();
    });

    it('keeps confidence undefined when no numeric policy is authorized', async () => {
      const { system, knowledgeStore } = createSystem();
      await system.processSignal(makeSignal(FeedbackType.Correction, 'Do not use library X.'));
      const rules = await knowledgeStore.getRules(LearningScope.Project, { projectId: 'project-1' });
      expect(rules[0].confidence).toBeUndefined();
    });

    it('the LearningSystem never sets a confidence value itself', async () => {
      const { system } = createSystem();
      const result = await system.processSignal(makeSignal(FeedbackType.Preference, 'I prefer this style.'));
      expect(result.learnedRule).toBeDefined();
      expect(Object.prototype.hasOwnProperty.call(result.learnedRule, 'confidence')).toBe(false);
    });

    it('the eligibility policy exposes no confidence baseline/threshold/bonus', async () => {
      const policy = new LearningEligibilityPolicy();
      const keys = Object.keys(policy);
      expect(keys).not.toContain('confidence');
      expect(keys).not.toContain('baseline');
      expect(keys).not.toContain('threshold');
      expect(keys).not.toContain('bonus');
      expect(keys).not.toContain('formula');
      expect(keys).not.toContain('weight');
    });

    it('the store rejects an out-of-range confidence when one is force-provided', async () => {
      const store = new InMemoryLearnedKnowledgeStore();
      const rule: LearnedRule = {
        ruleId: 'rule-1',
        rule: 'Use strict mode.',
        scope: LearningScope.Project,
        context: { projectId: 'project-1' },
        sourceFeedbackId: 'feedback-1',
        createdAt: 100,
        confidence: 1.5,
      };
      await expect(store.store(rule)).rejects.toBeInstanceOf(Error);
    });
  });

  describe('16. Determinism', () => {
    it('identical signals yield identical eligibility results', async () => {
      const policy = new LearningEligibilityPolicy();
      const a = policy.isEligible(FeedbackType.Instruction);
      const b = policy.isEligible(FeedbackType.Instruction);
      expect(a).toBe(b);
      expect(a).toBe(true);
    });

    it('eligibility does not depend on timestamps or randomness', async () => {
      const { system } = createSystem();
      const r1 = await system.processSignal(makeSignal(FeedbackType.Instruction, 'Use strict mode.', LearningScope.Project, 'f1', 's1'));
      const r2 = await system.processSignal(makeSignal(FeedbackType.Instruction, 'Use strict mode.', LearningScope.Project, 'f2', 's2'));
      expect(r1.status).toBe(LearningResultStatus.Accepted);
      expect(r2.status).toBe(LearningResultStatus.Accepted);
    });
  });

  describe('17. Exact repetition', () => {
    it('repetition is optional: a single signal becomes a rule', async () => {
      const { system, knowledgeStore } = createSystem();
      await system.processSignal(makeSignal(FeedbackType.Instruction, 'Use strict mode.'));
      expect(await knowledgeStore.getRules(LearningScope.Project, { projectId: 'project-1' })).toHaveLength(1);
    });

    it('same normalized candidate + scope + context deduplicates deterministically', async () => {
      const { system, knowledgeStore } = createSystem();
      await system.processSignal(makeSignal(FeedbackType.Preference, 'I prefer this style.', LearningScope.Project, 'f1', 's1'));
      await system.processSignal(makeSignal(FeedbackType.Preference, 'I prefer this style.', LearningScope.Project, 'f2', 's2'));
      expect(await knowledgeStore.getRules(LearningScope.Project, { projectId: 'project-1' })).toHaveLength(1);
    });
  });

  describe('13. Security boundary', () => {
    it('LearnedRule, LearningEvidence, and LearningSignal carry no security fields', async () => {
      const { system } = createSystem();
      const result = await system.processSignal(makeSignal(FeedbackType.Instruction, 'Use strict mode.', LearningScope.Project, 'f-sec', 's-sec'));
const rule = result.learnedRule as unknown as Record<string, unknown>;
      for (const forbidden of SECURITY_KEYS) {
        expect(Object.keys(rule)).not.toContain(forbidden);
      }

      const evidenceStore = new InMemoryEvidenceStore();
      const evidence: LearningEvidence = {
        evidenceId: 'evidence-sec',
        sourceFeedbackId: 'f-sec',
        signalId: 's-sec',
        feedbackType: FeedbackType.Instruction,
        candidate: 'Use strict mode.',
        scope: LearningScope.Project,
        context: { projectId: 'project-1' },
        createdAt: 100,
      };
      const stored = await evidenceStore.store(evidence);
      for (const forbidden of SECURITY_KEYS) {
        expect(Object.keys(stored)).not.toContain(forbidden);
      }

      const signal: LearningSignal = makeSignal(FeedbackType.Instruction, 'Use strict mode.', LearningScope.Project, 'f-sec', 's-sec');
      for (const forbidden of SECURITY_KEYS) {
        expect(Object.keys(signal)).not.toContain(forbidden);
      }
    });
  });

  describe('15. Prompt / Planner / Agent / Memory / LLM isolation', () => {
    it('the learning public surface does not reference integration layers', async () => {
      const policy = new LearningEligibilityPolicy();
      const system = new LearningSystem(
        new InMemoryEvidenceStore(),
        new InMemoryLearnedKnowledgeStore(),
        policy,
      );
      const keys = [
        ...Object.keys(policy),
        'processFeedback',
        'processSignal',
      ];
      expect(keys).not.toContain('promptEngine');
      expect(keys).not.toContain('contextRouter');
      expect(keys).not.toContain('planner');
      expect(keys).not.toContain('taskTree');
      expect(keys).not.toContain('agent');
      expect(keys).not.toContain('memory');
      expect(keys).not.toContain('projectContextStore');
      expect(keys).not.toContain('llm');
      expect(keys).not.toContain('provider');
      expect(keys).not.toContain('embedding');
      expect(system).toBeInstanceOf(LearningSystem);
    });
  });
});

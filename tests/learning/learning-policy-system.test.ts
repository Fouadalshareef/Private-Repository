import { describe, expect, it } from 'vitest';
import {
  EligibilityPolicyError,
  FeedbackSource,
  FeedbackType,
  InMemoryEvidenceStore,
  InMemoryLearnedKnowledgeStore,
  LearningEligibilityPolicy,
  LearningInputKind,
  LearningResultStatus,
  LearningScope,
  LearningSystem,
  type LearningSignal,
} from '../../src/learning/index.js';

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

describe('LearningEligibilityPolicy', () => {
  it('marks only Instruction, Correction, and Preference eligible', () => {
    const policy = new LearningEligibilityPolicy();
    expect(policy.isEligible(FeedbackType.Instruction)).toBe(true);
    expect(policy.isEligible(FeedbackType.Correction)).toBe(true);
    expect(policy.isEligible(FeedbackType.Preference)).toBe(true);
    expect(policy.isEligible(FeedbackType.Rejection)).toBe(false);
    expect(policy.isEligible(FeedbackType.Approval)).toBe(false);
    expect(policy.isEligible(FeedbackType.Rating)).toBe(false);
  });

  it('rejects an invalid feedback type', () => {
    const policy = new LearningEligibilityPolicy();
    expect(() => policy.isEligible('not-a-type' as FeedbackType)).toThrow(EligibilityPolicyError);
  });

  it('normalizes candidate text deterministically without computing confidence', () => {
    const policy = new LearningEligibilityPolicy();
    expect(policy.normalize('  Use   strict  mode. ')).toBe('Use strict mode.');
  });

  it('does not implement any numeric confidence policy', () => {
    const policy = new LearningEligibilityPolicy();
    expect('confidence' in policy).toBe(false);
    expect(Object.keys(policy)).not.toContain('REPETITION_BONUS');
  });
});

describe('LearningSystem', () => {
  it('promotes an instruction to a learned rule without confidence', async () => {
    const { system, knowledgeStore } = createSystem();
    const result = await system.processSignal(makeSignal(FeedbackType.Instruction, 'Use TypeScript strict mode.'));

    expect(result.status).toBe(LearningResultStatus.Accepted);
    expect(result.learnedRule).toBeDefined();
    expect(result.learnedRule?.rule).toBe('Use TypeScript strict mode.');
    expect(result.learnedRule?.confidence).toBeUndefined();
    expect(result.learnedRule?.sourceFeedbackId).toBe('feedback-1');
    expect(result.learnedRule?.scope).toBe(LearningScope.Project);

    const rules = await knowledgeStore.getRules(LearningScope.Project, { projectId: 'project-1' });
    expect(rules).toHaveLength(1);
    expect(rules[0].confidence).toBeUndefined();
  });

  it('preserves correction and preference meaning without adding claims', async () => {
    const { system } = createSystem();
    const correction = await system.processSignal(makeSignal(FeedbackType.Correction, 'Do not use library X.'));
    const preference = await system.processSignal(makeSignal(FeedbackType.Preference, 'I prefer this style.'));

    expect(correction.status).toBe(LearningResultStatus.Accepted);
    expect(correction.learnedRule?.rule).toBe('Do not use library X.');
    expect(preference.learnedRule?.rule).toBe('I prefer this style.');
  });

  it('does not promote rejection, approval, or rating', async () => {
    const { system } = createSystem();
    const rejection = await system.processSignal(makeSignal(FeedbackType.Rejection, 'I do not want this plan.'));
    const approval = await system.processSignal(makeSignal(FeedbackType.Approval, 'Excellent result.'));
    const rating = await system.processSignal(makeSignal(FeedbackType.Rating, 'Rating'));

    expect(rejection.status).toBe(LearningResultStatus.Ignored);
    expect(approval.status).toBe(LearningResultStatus.Ignored);
    expect(rating.status).toBe(LearningResultStatus.Ignored);
  });

  it('keeps rejection scoped and does not generalize it', async () => {
    const { system } = createSystem();
    const result = await system.processSignal(makeSignal(FeedbackType.Rejection, 'I do not want this plan.', LearningScope.Session));
    expect(result.status).toBe(LearningResultStatus.Ignored);
  });

  it('preserves scope for session, conversation, and project', async () => {
    const { system, knowledgeStore } = createSystem();
    await system.processSignal(makeSignal(FeedbackType.Instruction, 'Keep this boundary.', LearningScope.Session));
    await system.processSignal(makeSignal(FeedbackType.Instruction, 'Keep this boundary.', LearningScope.Conversation));
    await system.processSignal(makeSignal(FeedbackType.Instruction, 'Keep this boundary.', LearningScope.Project));

    expect((await knowledgeStore.getRules(LearningScope.Session, { sessionId: 'session-1' }))).toHaveLength(1);
    expect((await knowledgeStore.getRules(LearningScope.Conversation, { conversationId: 'conversation-1' }))).toHaveLength(1);
    expect((await knowledgeStore.getRules(LearningScope.Project, { projectId: 'project-1' }))).toHaveLength(1);
  });

  it('does not widen scope across boundaries', async () => {
    const { system, knowledgeStore } = createSystem();
    await system.processSignal(makeSignal(FeedbackType.Preference, 'I prefer this style.', LearningScope.Session));

    const session = await knowledgeStore.getRules(LearningScope.Session, { sessionId: 'session-1' });
    const project = await knowledgeStore.getRules(LearningScope.Project, { projectId: 'project-1' });

    expect(session).toHaveLength(1);
    expect(project).toHaveLength(0);
  });

  it('records transient evidence for eligible signals and preserves identity', async () => {
    const { system, evidenceStore } = createSystem();
    await system.processSignal(makeSignal(FeedbackType.Instruction, 'Use strict mode.'));
    await system.processSignal(makeSignal(FeedbackType.Instruction, 'Use strict mode.', LearningScope.Project, 'feedback-2', 'signal-2'));

    expect(evidenceStore.size()).toBe(2);
    const all = await evidenceStore.getAll();
    expect(all[0].candidate).toBe('Use strict mode.');
    expect(all[0].sourceFeedbackId).toBe('feedback-1');
    expect(all[0].signalId).toBe('signal-1');
    expect(all[0].scope).toBe(LearningScope.Project);
  });

  it('does not duplicate a rule on repeated consistent evidence within the same scope', async () => {
    const { system, knowledgeStore } = createSystem();
    await system.processSignal(makeSignal(FeedbackType.Preference, 'I prefer this style.'));
    const second = await system.processSignal(makeSignal(FeedbackType.Preference, 'I prefer this style.', LearningScope.Project, 'feedback-2', 'signal-2'));

    expect(second.status).toBe(LearningResultStatus.Accepted);
    expect(second.learnedRule?.confidence).toBeUndefined();

    const rules = await knowledgeStore.getRules(LearningScope.Project, { projectId: 'project-1' });
    expect(rules).toHaveLength(1);
    expect(rules[0].confidence).toBeUndefined();
  });

  it('produces no security or authorization fields', async () => {
    const { system } = createSystem();
    const result = await system.processSignal(makeSignal(FeedbackType.Instruction, 'Use strict mode.'));
    const rule = result.learnedRule;
    expect(rule).toBeDefined();
    expect(rule).not.toBeNull();
    const keys = Object.keys(rule as object);
    expect(keys).not.toContain('permission');
    expect(keys).not.toContain('authorization');
    expect(keys).not.toContain('toolAccess');
    expect(keys).not.toContain('securityPolicy');
  });

  it('processes feedback without a signal as ignored', async () => {
    const { system } = createSystem();
    const result = await system.processFeedback({
      feedbackId: 'feedback-x',
      content: 'Use strict mode.',
      source: FeedbackSource.User,
      kind: LearningInputKind.ExplicitUserFeedback,
      type: FeedbackType.Instruction,
      scope: LearningScope.Project,
      context: { projectId: 'project-1' },
      timestamp: 100,
    });
    expect(result.status).toBe(LearningResultStatus.Ignored);
  });
});

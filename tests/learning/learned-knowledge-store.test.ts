import { describe, expect, it } from 'vitest';
import {
  InMemoryLearnedKnowledgeStore,
  LearnedKnowledgeStoreError,
  LearningScope,
  type LearnedRule,
} from '../../src/learning/index.js';

function makeRule(overrides: Partial<LearnedRule> = {}): LearnedRule {
  return Object.freeze({
    ruleId: 'rule-1',
    rule: 'Use TypeScript strict mode.',
    scope: LearningScope.Project,
    context: Object.freeze({ projectId: 'project-1' }),
    sourceFeedbackId: 'feedback-1',
    createdAt: 1000,
    confidence: 0.9,
    ...overrides,
  });
}

describe('InMemoryLearnedKnowledgeStore', () => {
  it('stores and retrieves a rule scoped to its context', async () => {
    const store = new InMemoryLearnedKnowledgeStore();
    const rule = makeRule();

    const stored = await store.store(rule);
    expect(stored.ruleId).toBe('rule-1');

    const rules = await store.getRules(LearningScope.Project, { projectId: 'project-1' });
    expect(rules).toHaveLength(1);
    expect(rules[0].rule).toBe('Use TypeScript strict mode.');
    expect(rules[0].sourceFeedbackId).toBe('feedback-1');
  });

  it('does not widen scope or context', async () => {
    const store = new InMemoryLearnedKnowledgeStore();
    await store.store(makeRule({ scope: LearningScope.Session, context: { sessionId: 'session-1' } }));

    const project = await store.getRules(LearningScope.Project, { projectId: 'project-1' });
    const session = await store.getRules(LearningScope.Session, { sessionId: 'session-1' });

    expect(project).toHaveLength(0);
    expect(session).toHaveLength(1);
  });

  it('returns a frozen rule and a frozen context', async () => {
    const store = new InMemoryLearnedKnowledgeStore();
    const stored = await store.store(makeRule());

    expect(Object.isFrozen(stored)).toBe(true);
    expect(Object.isFrozen(stored.context)).toBe(true);
  });

  it('does not store a duplicate rule (same text, scope, context)', async () => {
    const store = new InMemoryLearnedKnowledgeStore();
    const first = await store.store(makeRule());
    const dup = await store.store(makeRule({ ruleId: 'rule-2' }));

    expect(dup.ruleId).toBe('rule-1');
    expect(store.size()).toBe(1);
    expect(first.ruleId).toBe('rule-1');
  });

  it('stores distinct rules with different text or context', async () => {
    const store = new InMemoryLearnedKnowledgeStore();
    await store.store(makeRule());
    await store.store(makeRule({ ruleId: 'rule-2', rule: 'Do not use library X.', context: { projectId: 'project-2' } }));

    expect(store.size()).toBe(2);
  });

  it('updates an existing rule and preserves provenance', async () => {
    const store = new InMemoryLearnedKnowledgeStore();
    await store.store(makeRule());

    const updated = await store.update(makeRule({ rule: 'Use TypeScript strict mode in this project.' }));
    expect(updated.rule).toBe('Use TypeScript strict mode in this project.');
    expect(updated.sourceFeedbackId).toBe('feedback-1');

    const rules = await store.getRules(LearningScope.Project, { projectId: 'project-1' });
    expect(rules).toHaveLength(1);
    expect(rules[0].rule).toBe('Use TypeScript strict mode in this project.');
  });

  it('throws when updating a missing rule', async () => {
    const store = new InMemoryLearnedKnowledgeStore();
    await expect(store.update(makeRule())).rejects.toBeInstanceOf(LearnedKnowledgeStoreError);
  });

  it('removes a rule and returns true', async () => {
    const store = new InMemoryLearnedKnowledgeStore();
    await store.store(makeRule());

    expect(await store.remove('rule-1')).toBe(true);
    expect(store.size()).toBe(0);
  });

  it('returns false when removing a missing rule', async () => {
    const store = new InMemoryLearnedKnowledgeStore();
    expect(await store.remove('missing')).toBe(false);
  });

  it('rejects invalid rules (empty text, bad scope, bad context, bad confidence)', async () => {
    const store = new InMemoryLearnedKnowledgeStore();

    await expect(store.store(makeRule({ rule: '   ' }))).rejects.toBeInstanceOf(LearnedKnowledgeStoreError);
    await expect(store.store(makeRule({ scope: 'not-a-scope' as LearningScope, context: { projectId: 'p' } })))
      .rejects.toBeInstanceOf(LearnedKnowledgeStoreError);
    await expect(store.store(makeRule({ context: {} as LearnedRule['context'] })))
      .rejects.toBeInstanceOf(LearnedKnowledgeStoreError);
    await expect(store.store(makeRule({ confidence: Number.NaN })))
      .rejects.toBeInstanceOf(LearnedKnowledgeStoreError);
  });

  it('does not grant authorization or expose security fields', async () => {
    const store = new InMemoryLearnedKnowledgeStore();
    const stored = await store.store(makeRule());

    expect(Object.keys(stored)).not.toContain('permission');
    expect(Object.keys(stored)).not.toContain('authorization');
    expect(Object.keys(stored)).not.toContain('toolAccess');
    expect(Object.keys(stored)).not.toContain('securityPolicy');
  });

  it('is transient and does not persist across instances', async () => {
    const store = new InMemoryLearnedKnowledgeStore();
    await store.store(makeRule());

    const other = new InMemoryLearnedKnowledgeStore();
    const rules = await other.getRules(LearningScope.Project, { projectId: 'project-1' });
    expect(rules).toHaveLength(0);
  });
});

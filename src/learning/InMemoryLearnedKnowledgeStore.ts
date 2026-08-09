import type { ILearnedKnowledgeStore } from './interfaces.js';
import {
  LearningScope,
  type LearnedRule,
  type LearningContext,
} from './types.js';

/**
 * Thrown when a learned-knowledge store operation is invalid.
 */
export class LearnedKnowledgeStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LearnedKnowledgeStoreError';
  }
}

/**
 * An in-memory implementation of {@link ILearnedKnowledgeStore}.
 *
 * This store is intentionally transient: it holds learned rules only for the
 * lifetime of the process. It does not write to any database, vector store,
 * memory, filesystem, or external backend. No persistence policy is introduced
 * here; persistence is a separate, deferred architectural decision.
 *
 * Deduplication is conservative and exact: a rule is considered a duplicate of
 * an existing stored rule when it has the same normalized rule text, scope, and
 * context identifiers. No hashing or semantic-similarity system is introduced.
 *
 * This store ONLY manages storage of already-constructed {@link LearnedRule}
 * objects. It does not create rules, compute confidence, grant authorization,
 * touch the Planner, Agent, Prompt, or Security layers.
 */
export class InMemoryLearnedKnowledgeStore implements ILearnedKnowledgeStore {
  private readonly rules: Map<string, LearnedRule>;

  constructor() {
    this.rules = new Map<string, LearnedRule>();
  }

  public async store(rule: LearnedRule): Promise<LearnedRule> {
    this.validateRule(rule);

    const existing = this.findDuplicate(rule);
    // A duplicate with the same scope/context is not stored a second time.
    if (existing) {
      return existing;
    }

    const stored = this.freeze(rule);
    this.rules.set(stored.ruleId, stored);
    return stored;
  }

  public async getRules(scope: LearningScope, context: LearningContext): Promise<readonly LearnedRule[]> {
    this.validateScope(scope);
    this.validateContext(context);

    const matches: LearnedRule[] = [];
    for (const rule of this.rules.values()) {
      if (rule.scope === scope && this.contextMatches(rule.context, context)) {
        matches.push(rule);
      }
    }
    matches.sort((a, b) => a.createdAt - b.createdAt);
    return Object.freeze(matches);
  }

  public async update(rule: LearnedRule): Promise<LearnedRule> {
    this.validateRule(rule);
    if (!this.rules.has(rule.ruleId)) {
      throw new LearnedKnowledgeStoreError(`Learned rule not found: ${rule.ruleId}`);
    }
    const updated = this.freeze(rule);
    this.rules.set(updated.ruleId, updated);
    return updated;
  }

  public async remove(ruleId: string): Promise<boolean> {
    if (typeof ruleId !== 'string' || ruleId.length === 0) {
      throw new LearnedKnowledgeStoreError('Learned rule id must be a non-empty string.');
    }
    return this.rules.delete(ruleId);
  }

  /** Returns the number of stored rules (test/observability helper). */
  public size(): number {
    return this.rules.size;
  }

  private findDuplicate(rule: LearnedRule): LearnedRule | undefined {
    for (const existing of this.rules.values()) {
      if (
        existing.rule === rule.rule &&
        existing.scope === rule.scope &&
        this.contextEquals(existing.context, rule.context)
      ) {
        return existing;
      }
    }
    return undefined;
  }

  private contextEquals(a: LearningContext, b: LearningContext): boolean {
    return (
      a.sessionId === b.sessionId &&
      a.conversationId === b.conversationId &&
      a.projectId === b.projectId
    );
  }

  private contextMatches(stored: LearningContext, query: LearningContext): boolean {
    // A stored rule matches a query when the query identifiers are a subset of
    // the stored identifiers (same boundary, no widening of scope).
    if (query.sessionId !== undefined && stored.sessionId !== query.sessionId) {
      return false;
    }
    if (query.conversationId !== undefined && stored.conversationId !== query.conversationId) {
      return false;
    }
    if (query.projectId !== undefined && stored.projectId !== query.projectId) {
      return false;
    }
    return true;
  }

  private validateRule(rule: LearnedRule): void {
    if (!rule || typeof rule.ruleId !== 'string' || rule.ruleId.length === 0) {
      throw new LearnedKnowledgeStoreError('Learned rule requires a non-empty ruleId.');
    }
    if (typeof rule.rule !== 'string' || rule.rule.trim().length === 0) {
      throw new LearnedKnowledgeStoreError('Learned rule text must be a non-empty string.');
    }
    this.validateScope(rule.scope);
    this.validateContext(rule.context);
    if (typeof rule.sourceFeedbackId !== 'string' || rule.sourceFeedbackId.length === 0) {
      throw new LearnedKnowledgeStoreError('Learned rule requires a non-empty sourceFeedbackId.');
    }
    if (typeof rule.confidence !== 'number' || !Number.isFinite(rule.confidence)) {
      throw new LearnedKnowledgeStoreError('Learned rule confidence must be a finite number.');
    }
  }

  private validateScope(scope: LearningScope): void {
    switch (scope) {
      case LearningScope.Session:
      case LearningScope.Conversation:
      case LearningScope.Project:
        return;
      default:
        throw new LearnedKnowledgeStoreError('Learned rule scope is invalid.');
    }
  }

  private validateContext(context: LearningContext): void {
    if (!context || typeof context !== 'object') {
      throw new LearnedKnowledgeStoreError('Learned rule context must be an object.');
    }
    const hasBoundary =
      typeof context.sessionId === 'string' ||
      typeof context.conversationId === 'string' ||
      typeof context.projectId === 'string';
    if (!hasBoundary) {
      throw new LearnedKnowledgeStoreError('Learned rule context must include a session, conversation, or project identifier.');
    }
  }

  private freeze(rule: LearnedRule): LearnedRule {
    return Object.freeze({
      ...rule,
      context: Object.freeze({ ...rule.context }),
    });
  }
}

import type { IEvidenceStore } from './interfaces.js';
import {
  LearningScope,
  type LearningContext,
  type LearningEvidence,
} from './types.js';

/** Thrown when an evidence-store operation is invalid. */
export class EvidenceStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvidenceStoreError';
  }
}

/**
 * A transient, in-memory store for {@link LearningEvidence}.
 *
 * Evidence is held only for the lifetime of the process. It is not persisted
 * to Memory, a database, vector store, or any external backend. Evidence is
 * scoped exactly like its source signal and never widens its scope.
 *
 * This store only manages evidence storage; it does not compute confidence,
 * decide eligibility, or grant authorization.
 */
export class InMemoryEvidenceStore implements IEvidenceStore {
  private readonly items: Map<string, LearningEvidence>;

  constructor() {
    this.items = new Map<string, LearningEvidence>();
  }

  public async store(evidence: LearningEvidence): Promise<LearningEvidence> {
    this.validateEvidence(evidence);
    const stored = this.freeze(evidence);
    this.items.set(stored.evidenceId, stored);
    return stored;
  }

  public async getAll(): Promise<readonly LearningEvidence[]> {
    return Object.freeze(Array.from(this.items.values()).map((e) => this.freeze(e)));
  }

  public async getEvidence(scope: LearningScope, context: LearningContext): Promise<readonly LearningEvidence[]> {
    this.validateScope(scope);
    this.validateContext(context);

    const matches: LearningEvidence[] = [];
    for (const evidence of this.items.values()) {
      if (evidence.scope === scope && this.contextMatches(evidence.context, context)) {
        matches.push(this.freeze(evidence));
      }
    }
    matches.sort((a, b) => a.createdAt - b.createdAt);
    return Object.freeze(matches);
  }

  public async clear(scope: LearningScope, context: LearningContext): Promise<void> {
    this.validateScope(scope);
    this.validateContext(context);

    for (const [id, evidence] of this.items.entries()) {
      if (evidence.scope === scope && this.contextMatches(evidence.context, context)) {
        this.items.delete(id);
      }
    }
  }

  /** Returns the number of stored evidence items (test/observability helper). */
  public size(): number {
    return this.items.size;
  }

  private contextMatches(stored: LearningContext, query: LearningContext): boolean {
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

  private validateEvidence(evidence: LearningEvidence): void {
    if (!evidence || typeof evidence.evidenceId !== 'string' || evidence.evidenceId.length === 0) {
      throw new EvidenceStoreError('Evidence requires a non-empty evidenceId.');
    }
    if (typeof evidence.sourceFeedbackId !== 'string' || evidence.sourceFeedbackId.length === 0) {
      throw new EvidenceStoreError('Evidence requires a non-empty sourceFeedbackId.');
    }
    if (typeof evidence.signalId !== 'string' || evidence.signalId.length === 0) {
      throw new EvidenceStoreError('Evidence requires a non-empty signalId.');
    }
    if (typeof evidence.candidate !== 'string' || evidence.candidate.trim().length === 0) {
      throw new EvidenceStoreError('Evidence candidate must be a non-empty string.');
    }
    this.validateScope(evidence.scope);
    this.validateContext(evidence.context);
  }

  private validateScope(scope: LearningScope): void {
    switch (scope) {
      case LearningScope.Session:
      case LearningScope.Conversation:
      case LearningScope.Project:
        return;
      default:
        throw new EvidenceStoreError('Evidence scope is invalid.');
    }
  }

  private validateContext(context: LearningContext): void {
    if (!context || typeof context !== 'object') {
      throw new EvidenceStoreError('Evidence context must be an object.');
    }
    const hasBoundary =
      typeof context.sessionId === 'string' ||
      typeof context.conversationId === 'string' ||
      typeof context.projectId === 'string';
    if (!hasBoundary) {
      throw new EvidenceStoreError('Evidence context must include a session, conversation, or project identifier.');
    }
  }

  private freeze(evidence: LearningEvidence): LearningEvidence {
    return Object.freeze({
      ...evidence,
      context: Object.freeze({ ...evidence.context }),
    });
  }
}

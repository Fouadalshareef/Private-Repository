import type { IEventBus } from '../events/IEventBus.js';
import type { AdvisorSession } from './AdvisorSession.js';
import type { ConversationSnapshot } from './ConversationSnapshot.js';
import type { ConversationSummary } from './ConversationSummary.js';
import type { SessionLifecyclePayload, SessionSwitchedPayload, SnapshotCreatedPayload, SummaryUpdatedPayload } from './ConversationEvents.js';
import { ConversationSessionStatus } from './ConversationState.js';
import { ConversationEvents } from './ConversationEvents.js';
import { createAdvisorSession } from './AdvisorSession.js';
import { createConversationSnapshot } from './ConversationSnapshot.js';
import { createConversationSummary } from './ConversationSummary.js';
import { SessionNotFoundError, InvalidSessionStateError } from './ConversationError.js';

/**
 * Configuration for ConversationSessionManager.
 */
export interface ConversationSessionManagerConfig {
  readonly eventBus?: IEventBus;
  readonly snapshotInterval?: number;
}

/**
 * Manages advisor sessions within a workspace.
 */
export class ConversationSessionManager {
  private readonly eventBus?: IEventBus;
  private readonly snapshotInterval: number;
  private readonly sessions: Map<string, AdvisorSession>;
  private readonly snapshots: Map<string, ConversationSnapshot[]>;
  private readonly summaries: Map<string, ConversationSummary>;
  private currentSessionId: string | undefined;
  private sessionCounter = 0;
  private snapshotCounter = 0;
  private summaryCounter = 0;

  constructor(config: ConversationSessionManagerConfig = {}) {
    this.eventBus = config.eventBus;
    this.snapshotInterval = config.snapshotInterval ?? 20;
    this.sessions = new Map();
    this.snapshots = new Map();
    this.summaries = new Map();
  }

  /**
   * Creates a new advisor session.
   */
  createSession(workspaceId: string, advisorId: string): AdvisorSession {
    const sessionId = `session-${workspaceId}-${++this.sessionCounter}`;
    const now = Date.now();

    const session = createAdvisorSession({
      sessionId,
      workspaceId,
      advisorId,
      messages: Object.freeze([]),
      createdAt: now,
      updatedAt: now,
      metadata: Object.freeze({}),
      status: ConversationSessionStatus.ACTIVE,
      lastActivity: now,
    });

    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;

    this.publishEvent(ConversationEvents.SESSION_CREATED, {
      workspaceId,
      sessionId,
      advisorId,
      timestamp: now,
    } as SessionLifecyclePayload);

    return session;
  }

  /**
   * Closes a session.
   */
  closeSession(sessionId: string): AdvisorSession {
    const existing = this.getSessionOrThrow(sessionId);

    if (existing.status === ConversationSessionStatus.CLOSED) {
      throw new InvalidSessionStateError(existing.status);
    }

    const closed = createAdvisorSession({
      ...existing,
      status: ConversationSessionStatus.CLOSED,
      updatedAt: Date.now(),
    });

    this.sessions.set(sessionId, closed);

    if (this.currentSessionId === sessionId) {
      this.currentSessionId = undefined;
    }

    this.publishEvent(ConversationEvents.SESSION_CLOSED, {
      workspaceId: existing.workspaceId,
      sessionId,
      advisorId: existing.advisorId,
      timestamp: Date.now(),
    } as SessionLifecyclePayload);

    return closed;
  }

  /**
   * Switches to a different session.
   */
  switchSession(sessionId: string): AdvisorSession {
    const existing = this.getSessionOrThrow(sessionId);
    const previousSessionId = this.currentSessionId;

    if (existing.status === ConversationSessionStatus.CLOSED) {
      throw new InvalidSessionStateError(existing.status);
    }

    const activated = createAdvisorSession({
      ...existing,
      status: ConversationSessionStatus.ACTIVE,
      updatedAt: Date.now(),
      lastActivity: Date.now(),
    });

    this.sessions.set(sessionId, activated);
    this.currentSessionId = sessionId;

    this.publishEvent(ConversationEvents.SESSION_SWITCHED, {
      workspaceId: existing.workspaceId,
      previousSessionId,
      currentSessionId: sessionId,
      advisorId: existing.advisorId,
      timestamp: Date.now(),
    } as SessionSwitchedPayload);

    return activated;
  }

  /**
   * Adds a message to a session.
   */
  addMessage(sessionId: string, message: unknown): AdvisorSession {
    const existing = this.getSessionOrThrow(sessionId);

    if (existing.status === ConversationSessionStatus.CLOSED) {
      throw new InvalidSessionStateError(existing.status);
    }

    const updated = createAdvisorSession({
      ...existing,
      messages: Object.freeze([...existing.messages, message]),
      updatedAt: Date.now(),
      lastActivity: Date.now(),
    });

    this.sessions.set(sessionId, updated);

    this.maybeCreateSnapshot(updated);

    return updated;
  }

  /**
   * Gets a session by ID.
   */
  getSession(sessionId: string): AdvisorSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }
    return Object.freeze({ ...session }) as AdvisorSession;
  }

  /**
   * Gets the current active session.
   */
  getCurrentSession(): AdvisorSession | undefined {
    if (!this.currentSessionId) {
      return undefined;
    }
    return this.getSession(this.currentSessionId);
  }

  /**
   * Lists all sessions.
   */
  listSessions(): readonly AdvisorSession[] {
    return Object.freeze(Array.from(this.sessions.values()));
  }

  /**
   * Creates a snapshot for a session.
   */
  createSnapshot(sessionId: string): ConversationSnapshot {
    const session = this.getSessionOrThrow(sessionId);
    const snapshotId = `snapshot-${session.workspaceId}-${++this.snapshotCounter}`;

    const snapshot = createConversationSnapshot({
      snapshotId,
      sessionId,
      advisorId: session.advisorId,
      messages: session.messages,
      summary: this.getSummary(sessionId) ?? createConversationSummary({
        summaryId: `summary-${sessionId}`,
        sessionId,
        advisorId: session.advisorId,
        content: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      metadata: session.metadata,
      createdAt: Date.now(),
    });

    const sessionSnapshots = this.snapshots.get(sessionId) ?? [];
    sessionSnapshots.push(snapshot);
    this.snapshots.set(sessionId, sessionSnapshots);

    this.publishEvent(ConversationEvents.SNAPSHOT_CREATED, {
      workspaceId: session.workspaceId,
      sessionId,
      snapshotId,
      timestamp: Date.now(),
    } as SnapshotCreatedPayload);

    return snapshot;
  }

  /**
   * Gets snapshots for a session.
   */
  getSnapshots(sessionId: string): readonly ConversationSnapshot[] {
    return Object.freeze([...(this.snapshots.get(sessionId) ?? [])]);
  }

  /**
   * Updates the summary for a session.
   */
  updateSummary(sessionId: string, content: string): ConversationSummary {
    const session = this.getSessionOrThrow(sessionId);
    const summaryId = `summary-${sessionId}-${++this.summaryCounter}`;

    const summary = createConversationSummary({
      summaryId,
      sessionId,
      advisorId: session.advisorId,
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    this.summaries.set(sessionId, summary);

    this.publishEvent(ConversationEvents.SUMMARY_UPDATED, {
      workspaceId: session.workspaceId,
      sessionId,
      timestamp: Date.now(),
    } as SummaryUpdatedPayload);

    return summary;
  }

  /**
   * Gets the summary for a session.
   */
  getSummary(sessionId: string): ConversationSummary | undefined {
    return this.summaries.get(sessionId);
  }

  private getSessionOrThrow(sessionId: string): AdvisorSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    return session;
  }

  private maybeCreateSnapshot(session: AdvisorSession): void {
    const snapshots = this.snapshots.get(session.sessionId) ?? [];
    if (snapshots.length > 0 && session.messages.length % this.snapshotInterval === 0) {
      this.createSnapshot(session.sessionId);
    }
  }

  private publishEvent<T>(type: string, payload: T): void {
    if (this.eventBus) {
      this.eventBus.publish({
        type,
        timestamp: Date.now(),
        payload,
      });
    }
  }
}

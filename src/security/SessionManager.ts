import type { ISessionManager, SessionState, CreateSessionOptions, UpdateSessionOptions } from './ISessionManager.js';
import { SessionStatus } from './ISessionManager.js';
import type { IEventBus } from '../events/IEventBus.js';
import type { ILogger } from '../logging/ILogger.js';
import { SessionNotFoundError, SessionExpiredError } from './SecurityError.js';
import { SecurityEvents } from './SecurityEvents.js';

/**
 * Configuration options for SessionManager.
 */
export interface SessionManagerConfig {
  readonly eventBus?: IEventBus;
  readonly logger?: ILogger;
  /** Default TTL in milliseconds for new sessions. No TTL if omitted. */
  readonly defaultTtlMs?: number;
}

/**
 * Generates a simple unique session ID using crypto-like random hex without external deps.
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `sess_${timestamp}_${rand}`;
}

/**
 * Generates a simple unique approval token.
 */
function generateApprovalToken(): string {
  const timestamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 12);
  return `appr_${timestamp}_${rand}`;
}

// Re-export so SessionManager is self-contained
export { generateApprovalToken };

/**
 * Internal mutable session record (never exposed externally).
 */
interface MutableSession {
  id: string;
  status: SessionStatus;
  label?: string;
  metadata: Record<string, unknown>;
  createdAt: number;
  lastAccessedAt: number;
  expiresAt?: number;
}

/**
 * Freezes a mutable session into an immutable SessionState snapshot.
 */
function toSessionState(session: MutableSession): SessionState {
  return Object.freeze({
    id: session.id,
    status: session.status,
    label: session.label,
    metadata: Object.freeze({ ...session.metadata }),
    createdAt: session.createdAt,
    lastAccessedAt: session.lastAccessedAt,
    expiresAt: session.expiresAt,
  });
}

/**
 * Core implementation of ISessionManager.
 *
 * Maintains isolated per-session state with optional TTL expiration,
 * metadata management, and audit event broadcasting.
 */
export class SessionManager implements ISessionManager {
  private readonly store: Map<string, MutableSession> = new Map();
  private readonly eventBus?: IEventBus;
  private readonly logger?: ILogger;
  private readonly defaultTtlMs?: number;

  constructor(config: SessionManagerConfig = {}) {
    this.eventBus = config.eventBus;
    this.logger = config.logger;
    this.defaultTtlMs = config.defaultTtlMs;
  }

  // ---------------------------------------------------------------------------
  // ISessionManager implementation
  // ---------------------------------------------------------------------------

  /**
   * Creates a new session and returns its immutable state.
   */
  createSession(options: CreateSessionOptions = {}): SessionState {
    const id = options.id ?? generateSessionId();

    if (this.store.has(id)) {
      throw new Error(`Session with id "${id}" already exists.`);
    }

    const now = Date.now();
    const ttlMs = options.ttlMs ?? this.defaultTtlMs;

    const session: MutableSession = {
      id,
      status: SessionStatus.ACTIVE,
      label: options.label,
      metadata: { ...(options.metadata ?? {}) },
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: ttlMs !== undefined ? now + ttlMs : undefined,
    };

    this.store.set(id, session);

    this.logger?.info(`Session "${id}" created.`);
    this.publishEvent(SecurityEvents.SESSION_CREATED, {
      sessionId: id,
      label: session.label,
      timestamp: now,
    });

    return toSessionState(session);
  }

  /**
   * Retrieves the current (possibly expired) state of a session.
   * Returns undefined if no session with the given ID exists.
   */
  getSession(sessionId: string): SessionState | undefined {
    const session = this.store.get(sessionId);
    if (!session) {
      return undefined;
    }

    // Auto-mark expired sessions
    this.checkAndMarkExpired(session);

    return toSessionState(session);
  }

  /**
   * Updates metadata, label, or TTL of an existing session.
   */
  updateSession(sessionId: string, options: UpdateSessionOptions): SessionState {
    const session = this.requireActive(sessionId);
    const now = Date.now();

    if (options.metadata !== undefined) {
      Object.assign(session.metadata, options.metadata);
    }
    if (options.label !== undefined) {
      session.label = options.label;
    }
    if (options.ttlMs !== undefined) {
      session.expiresAt = now + options.ttlMs;
    }

    session.lastAccessedAt = now;

    return toSessionState(session);
  }

  /**
   * Terminates a session. Returns true if found and terminated.
   */
  terminateSession(sessionId: string): boolean {
    const session = this.store.get(sessionId);
    if (!session) {
      return false;
    }

    session.status = SessionStatus.TERMINATED;
    session.lastAccessedAt = Date.now();

    this.logger?.info(`Session "${sessionId}" terminated.`);
    this.publishEvent(SecurityEvents.SESSION_TERMINATED, {
      sessionId,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Returns true if the session exists and is ACTIVE (not expired/terminated).
   */
  isActive(sessionId: string): boolean {
    const session = this.store.get(sessionId);
    if (!session) {
      return false;
    }
    this.checkAndMarkExpired(session);
    return session.status === SessionStatus.ACTIVE;
  }

  /**
   * Evicts all sessions that have passed their expiresAt timestamp.
   * Returns the count of evicted sessions.
   */
  evictExpiredSessions(): number {
    const now = Date.now();
    let count = 0;

    for (const [, session] of this.store) {
      if (
        session.status === SessionStatus.ACTIVE &&
        session.expiresAt !== undefined &&
        now >= session.expiresAt
      ) {
        session.status = SessionStatus.EXPIRED;
        count++;

        this.logger?.info(`Session "${session.id}" evicted (expired).`);
        this.publishEvent(SecurityEvents.SESSION_EXPIRED, {
          sessionId: session.id,
          expiredAt: session.expiresAt,
          timestamp: now,
        });
      }
    }

    return count;
  }

  /**
   * Returns all currently ACTIVE sessions.
   */
  getActiveSessions(): readonly SessionState[] {
    this.evictExpiredSessions();
    const result: SessionState[] = [];
    for (const [, session] of this.store) {
      if (session.status === SessionStatus.ACTIVE) {
        result.push(toSessionState(session));
      }
    }
    return Object.freeze(result);
  }

  /**
   * Total count of all sessions (including terminated/expired).
   */
  get sessionCount(): number {
    return this.store.size;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Retrieves a session that must exist and be ACTIVE.
   * Throws SessionNotFoundError or SessionExpiredError otherwise.
   */
  private requireActive(sessionId: string): MutableSession {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    this.checkAndMarkExpired(session);
    if (session.status === SessionStatus.EXPIRED) {
      throw new SessionExpiredError(sessionId);
    }
    if (session.status === SessionStatus.TERMINATED) {
      throw new SessionNotFoundError(sessionId);
    }
    return session;
  }

  /**
   * Checks if a session has exceeded its TTL and marks it EXPIRED.
   */
  private checkAndMarkExpired(session: MutableSession): void {
    if (
      session.status === SessionStatus.ACTIVE &&
      session.expiresAt !== undefined &&
      Date.now() >= session.expiresAt
    ) {
      session.status = SessionStatus.EXPIRED;
      this.logger?.info(`Session "${session.id}" expired.`);
      this.publishEvent(SecurityEvents.SESSION_EXPIRED, {
        sessionId: session.id,
        expiredAt: session.expiresAt,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Publishes an event to the EventBus if configured.
   */
  private publishEvent<T>(type: string, payload: T): void {
    if (this.eventBus) {
      this.eventBus.publish({ type, timestamp: Date.now(), payload });
    }
  }
}

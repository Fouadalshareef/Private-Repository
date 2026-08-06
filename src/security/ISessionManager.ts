/**
 * Status of a managed session.
 */
export enum SessionStatus {
  /** Session is active and may be used. */
  ACTIVE = 'active',
  /** Session has been terminated and is no longer usable. */
  TERMINATED = 'terminated',
  /** Session has expired due to TTL elapsing. */
  EXPIRED = 'expired',
}

/**
 * Immutable snapshot of a session's state.
 */
export interface SessionState {
  /** Unique identifier for this session. */
  readonly id: string;
  /** Current lifecycle status. */
  readonly status: SessionStatus;
  /** Optional human-readable label for the session. */
  readonly label?: string;
  /** Arbitrary metadata associated with this session. */
  readonly metadata: Readonly<Record<string, unknown>>;
  /** Timestamp (ms) when the session was created. */
  readonly createdAt: number;
  /** Timestamp (ms) when the session was last accessed. */
  readonly lastAccessedAt: number;
  /** Timestamp (ms) when the session will expire, if set. */
  readonly expiresAt?: number;
}

/**
 * Options for creating a new session.
 */
export interface CreateSessionOptions {
  /** Optional explicit session ID. If omitted, one will be generated. */
  readonly id?: string;
  /** Optional human-readable label. */
  readonly label?: string;
  /** Optional initial metadata to attach to the session. */
  readonly metadata?: Readonly<Record<string, unknown>>;
  /** Optional TTL in milliseconds. Session expires after this duration. */
  readonly ttlMs?: number;
}

/**
 * Options for updating session metadata.
 */
export interface UpdateSessionOptions {
  /** Metadata keys to merge into the existing session metadata. */
  readonly metadata?: Readonly<Record<string, unknown>>;
  /** New label to set on the session. */
  readonly label?: string;
  /** New TTL in milliseconds from now. */
  readonly ttlMs?: number;
}

/**
 * Contract for the Session Manager module.
 */
export interface ISessionManager {
  /**
   * Creates a new session and returns its state.
   */
  createSession(options?: CreateSessionOptions): SessionState;

  /**
   * Retrieves the current state of a session.
   * Returns undefined if the session does not exist.
   */
  getSession(sessionId: string): SessionState | undefined;

  /**
   * Updates metadata and/or TTL of an existing session.
   * Returns the updated session state.
   * Throws SessionNotFoundError if session does not exist.
   */
  updateSession(sessionId: string, options: UpdateSessionOptions): SessionState;

  /**
   * Terminates a session, marking it as TERMINATED.
   * Returns true if the session was found and terminated.
   */
  terminateSession(sessionId: string): boolean;

  /**
   * Returns true if the session exists and is currently ACTIVE (not expired/terminated).
   */
  isActive(sessionId: string): boolean;

  /**
   * Evicts all sessions that have passed their expiresAt timestamp.
   * Returns the number of sessions evicted.
   */
  evictExpiredSessions(): number;

  /**
   * Returns all currently active sessions.
   */
  getActiveSessions(): readonly SessionState[];

  /**
   * Total count of all sessions (including terminated/expired).
   */
  readonly sessionCount: number;
}

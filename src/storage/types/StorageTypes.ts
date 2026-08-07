import type { AdvisorSession } from '../../conversation/AdvisorSession.js';

/**
 * Current on-disk storage format version.
 */
export const STORAGE_FORMAT_VERSION = 1;

/**
 * Serialized envelope for a persisted advisor session.
 */
export interface StoredSession {
  readonly version: number;
  readonly storedAt: number;
  readonly session: AdvisorSession;
}

/**
 * Lightweight descriptor returned when listing stored sessions.
 */
export interface SessionListEntry {
  readonly sessionId: string;
  readonly workspaceId: string;
  readonly advisorId: string;
  readonly messageCount: number;
  readonly status: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lastActivity: number;
}

/**
 * Configuration for a conversation store.
 */
export interface ConversationStoreConfig {
  /** Base directory where session files are stored (e.g. `.cupaw/sessions`). */
  readonly baseDir: string;
  /** When true (default), writes go through a temporary file then atomic rename. */
  readonly atomicWrite?: boolean;
}

/**
 * Options controlling the pruning of old sessions.
 */
export interface PruneOptions {
  /** Purge sessions older than this many milliseconds (based on updatedAt). */
  readonly maxAgeMs?: number;
  /** Keep at most this many most-recent sessions (per workspace if workspaceId set). */
  readonly maxCount?: number;
  /** Restrict pruning to a single workspace. */
  readonly workspaceId?: string;
}

/**
 * Result of a pruning operation.
 */
export interface PruneResult {
  readonly purged: readonly string[];
  readonly remaining: number;
}

/**
 * Base class for all storage-related errors.
 */
export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Thrown when a stored session file is corrupted or cannot be deserialized.
 */
export class CorruptedSessionError extends StorageError {
  public readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Session data is corrupted or unreadable: ${sessionId}`);
    this.name = 'CorruptedSessionError';
    this.sessionId = sessionId;
  }
}

/**
 * Thrown when a path-traversal attempt is detected and blocked.
 */
export class PathTraversalError extends StorageError {
  public readonly attemptedPath: string;

  constructor(attemptedPath: string) {
    super(`Path traversal detected and blocked: ${attemptedPath}`);
    this.name = 'PathTraversalError';
    this.attemptedPath = attemptedPath;
  }
}

/**
 * Thrown when a session write fails.
 */
export class SessionWriteError extends StorageError {
  public readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Failed to write session: ${sessionId}`);
    this.name = 'SessionWriteError';
    this.sessionId = sessionId;
  }
}

/**
 * Recursively freezes a value and all of its nested objects/arrays.
 * Safe to call on already-frozen values (no-op).
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const child = record[key];
    if (child !== null && typeof child === 'object') {
      deepFreeze(child);
    }
  }
  return value;
}

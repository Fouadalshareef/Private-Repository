import type { AdvisorSession } from '../conversation/AdvisorSession.js';
import type { SessionListEntry, PruneOptions, PruneResult } from './types/StorageTypes.js';

/**
 * Contract for a file-based conversation persistence store.
 *
 * All implementations must guarantee:
 * - Recursive immutability of loaded objects (via Object.freeze).
 * - Atomic writes (write to temp file then replace) to prevent corruption.
 * - Path sandboxing inside the configured base directory.
 * - Non-blocking async I/O (fs/promises).
 */
export interface IConversationStore {
  /**
   * Persists a single advisor session. Creates or replaces the stored file.
   */
  saveSession(session: AdvisorSession): Promise<void>;

  /**
   * Loads a single advisor session by id.
   * @throws CorruptedSessionError if the file is missing, unreadable, or malformed.
   */
  loadSession(sessionId: string): Promise<AdvisorSession>;

  /**
   * Lists stored sessions, optionally filtered by workspace.
   */
  listSessions(workspaceId?: string): Promise<readonly SessionListEntry[]>;

  /**
   * Deletes a stored session. Returns true if a file was removed.
   */
  deleteSession(sessionId: string): Promise<boolean>;

  /**
   * Purges or archives old sessions by age and/or count limit.
   */
  pruneSessions(options?: PruneOptions): Promise<PruneResult>;
}

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AdvisorSession } from '../conversation/AdvisorSession.js';
import type { IConversationStore } from './IConversationStore.js';
import {
  type ConversationStoreConfig,
  type SessionListEntry,
  type PruneOptions,
  type PruneResult,
  type StoredSession,
  STORAGE_FORMAT_VERSION,
  CorruptedSessionError,
  PathTraversalError,
  SessionWriteError,
  deepFreeze,
} from './types/StorageTypes.js';

/**
 * File-based implementation of {@link IConversationStore}.
 *
 * Sessions are stored as JSON files under `<baseDir>/<sessionId>.json`.
 * Writes are atomic (temp file + rename). Loaded objects are recursively frozen.
 * All paths are sandboxed inside `baseDir` and validated against traversal.
 */
export class FileConversationStore implements IConversationStore {
  private readonly baseDir: string;
  private readonly atomicWrite: boolean;
  private readonly pendingWrites = new Map<string, Promise<void>>();

  constructor(config: ConversationStoreConfig) {
    this.baseDir = path.resolve(config.baseDir);
    this.atomicWrite = config.atomicWrite ?? true;
  }

  public async saveSession(session: AdvisorSession): Promise<void> {
    const sessionId = session.sessionId;
    const previousWrite = this.pendingWrites.get(sessionId) ?? Promise.resolve();
    const write = previousWrite
      .catch(() => undefined)
      .then(() => this.writeSession(session));

    const pendingWrite = write.finally(() => {
      if (this.pendingWrites.get(sessionId) === pendingWrite) {
        this.pendingWrites.delete(sessionId);
      }
    });
    this.pendingWrites.set(sessionId, pendingWrite);

    await pendingWrite;
  }

  private async writeSession(session: AdvisorSession): Promise<void> {
    const sessionId = session.sessionId;
    const target = this.resolveSessionPath(sessionId);

    const envelope: StoredSession = {
      version: STORAGE_FORMAT_VERSION,
      storedAt: Date.now(),
      session: deepFreeze({ ...session }),
    };

    const payload = JSON.stringify(envelope, null, 2);

    try {
      await fs.mkdir(this.baseDir, { recursive: true });

      if (this.atomicWrite) {
        const nonce = Math.random().toString(36).slice(2, 12);
        const tmp = `${target}.${process.pid}.${Date.now()}.${nonce}.tmp`;
        await fs.writeFile(tmp, payload, 'utf8');
        await fs.rename(tmp, target);
      } else {
        await fs.writeFile(target, payload, 'utf8');
      }
    } catch {
      throw new SessionWriteError(sessionId);
    }
  }

  public async loadSession(sessionId: string): Promise<AdvisorSession> {
    const target = this.resolveSessionPath(sessionId);

    let raw: string;
    try {
      raw = await fs.readFile(target, 'utf8');
    } catch {
      throw new CorruptedSessionError(sessionId);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new CorruptedSessionError(sessionId);
    }

    return this.extractSession(parsed, sessionId);
  }

  public async listSessions(workspaceId?: string): Promise<readonly SessionListEntry[]> {
    let files: string[];
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      files = await fs.readdir(this.baseDir);
    } catch {
      return Object.freeze([]);
    }

    const entries: SessionListEntry[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }
      const target = path.join(this.baseDir, file);
      let raw: string;
      try {
        raw = await fs.readFile(target, 'utf8');
      } catch {
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Corrupted or unreadable file: isolate it and continue listing.
        continue;
      }

      const session = this.tryExtractSession(parsed);
      if (!session) {
        continue;
      }
      if (workspaceId !== undefined && session.workspaceId !== workspaceId) {
        continue;
      }

      entries.push(
        Object.freeze({
          sessionId: session.sessionId,
          workspaceId: session.workspaceId,
          advisorId: session.advisorId,
          messageCount: session.messages.length,
          status: session.status,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          lastActivity: session.lastActivity,
        }),
      );
    }

    entries.sort((a, b) => b.updatedAt - a.updatedAt);
    return Object.freeze(entries);
  }

  public async deleteSession(sessionId: string): Promise<boolean> {
    const target = this.resolveSessionPath(sessionId);
    try {
      await fs.unlink(target);
      return true;
    } catch {
      return false;
    }
  }

  public async pruneSessions(options?: PruneOptions): Promise<PruneResult> {
    const entries = await this.listSessions(options?.workspaceId);
    const candidates = [...entries].sort((a, b) => b.updatedAt - a.updatedAt);

    const toPurge: string[] = [];
    candidates.forEach((entry, index) => {
      const ageMs = Date.now() - entry.updatedAt;
      const tooOld = options?.maxAgeMs !== undefined && ageMs > options.maxAgeMs;
      const overCount = options?.maxCount !== undefined && index >= options.maxCount;
      if (tooOld || overCount) {
        toPurge.push(entry.sessionId);
      }
    });

    const purged: string[] = [];
    for (const id of toPurge) {
      if (await this.deleteSession(id)) {
        purged.push(id);
      }
    }

    const remaining = (await this.listSessions(options?.workspaceId)).length;
    return Object.freeze({
      purged: Object.freeze(purged),
      remaining,
    });
  }

  /**
   * Validates a stored envelope and extracts the advisor session.
   * @throws CorruptedSessionError if the shape is invalid.
   */
  private extractSession(parsed: unknown, sessionId: string): AdvisorSession {
    const session = this.tryExtractSession(parsed);
    if (!session) {
      throw new CorruptedSessionError(sessionId);
    }
    if (session.sessionId !== sessionId) {
      throw new CorruptedSessionError(sessionId);
    }
    return session;
  }

  /**
   * Validates and reconstructs an AdvisorSession from a parsed envelope.
   * Returns undefined (never throws) so callers can isolate bad files.
   */
  private tryExtractSession(parsed: unknown): AdvisorSession | undefined {
    if (parsed === null || typeof parsed !== 'object') {
      return undefined;
    }
    const envelope = parsed as Partial<StoredSession>;
    const session = envelope.session as unknown;
    if (session === null || typeof session !== 'object') {
      return undefined;
    }
    const s = session as Record<string, unknown>;
    if (
      typeof s.sessionId !== 'string' ||
      typeof s.workspaceId !== 'string' ||
      typeof s.advisorId !== 'string' ||
      !Array.isArray(s.messages) ||
      typeof s.createdAt !== 'number' ||
      typeof s.updatedAt !== 'number' ||
      typeof s.lastActivity !== 'number' ||
      typeof s.status !== 'string' ||
      typeof s.metadata !== 'object' ||
      s.metadata === null
    ) {
      return undefined;
    }

    const restored: AdvisorSession = {
      sessionId: s.sessionId,
      workspaceId: s.workspaceId,
      advisorId: s.advisorId,
      messages: Object.freeze([...s.messages]) as readonly unknown[],
      summary: typeof s.summary === 'string' ? s.summary : undefined,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      metadata: Object.freeze({ ...(s.metadata as Record<string, unknown>) }),
      status: s.status as AdvisorSession['status'],
      lastActivity: s.lastActivity,
    };

    return deepFreeze(restored);
  }

  /**
   * Resolves a session file path, strictly sandboxed inside the base directory.
   * @throws PathTraversalError if the id is unsafe or escapes the base dir.
   */
  private resolveSessionPath(sessionId: string): string {
    if (!/^[A-Za-z0-9._-]+$/.test(sessionId)) {
      throw new PathTraversalError(sessionId);
    }

    const base = path.resolve(this.baseDir);
    const target = path.resolve(base, `${sessionId}.json`);
    const baseWithSep = `${base}${path.sep}`;

    if (target !== base && !target.startsWith(baseWithSep)) {
      throw new PathTraversalError(sessionId);
    }

    return target;
  }
}

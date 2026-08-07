import {
  type IShortTermMemory,
  type MemoryRecord,
  deepFreeze,
  cloneValue,
  cloneRecord,
} from './types.js';

/**
 * In-memory, session-scoped short-term memory.
 *
 * Completely isolated from any persistence mechanism: values live only for the
 * process lifetime and are scoped per session id. All returned records are
 * deep-cloned and frozen to enforce immutability.
 */
export class ShortTermMemory implements IShortTermMemory {
  private readonly sessions: Map<string, Map<string, MemoryRecord>>;

  constructor() {
    this.sessions = new Map();
  }

  public set(sessionId: string, key: string, value: unknown): MemoryRecord {
    const now = Date.now();
    const record: MemoryRecord = Object.freeze({
      key,
      value: deepFreeze(cloneValue(value)),
      createdAt: now,
      updatedAt: now,
    });

    let sessionStore = this.sessions.get(sessionId);
    if (!sessionStore) {
      sessionStore = new Map();
      this.sessions.set(sessionId, sessionStore);
    }
    sessionStore.set(key, record);

    return cloneRecord(record);
  }

  public get(sessionId: string, key: string): MemoryRecord | undefined {
    const sessionStore = this.sessions.get(sessionId);
    const record = sessionStore?.get(key);
    if (!record) {
      return undefined;
    }
    return deepFreeze(cloneRecord(record));
  }

  public delete(sessionId: string, key: string): boolean {
    const sessionStore = this.sessions.get(sessionId);
    if (!sessionStore) {
      return false;
    }
    return sessionStore.delete(key);
  }

  public list(sessionId: string): readonly MemoryRecord[] {
    const sessionStore = this.sessions.get(sessionId);
    if (!sessionStore) {
      return Object.freeze([]);
    }
    const records = Array.from(sessionStore.values()).map((r) => deepFreeze(cloneRecord(r)));
    return Object.freeze(records);
  }

  public clear(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}

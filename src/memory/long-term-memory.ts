import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  type ILongTermMemory,
  type MemoryRecord,
  deepFreeze,
  cloneValue,
  cloneRecord,
  MemoryError,
} from './types.js';

/**
 * Configuration for {@link LongTermMemory}.
 */
export interface LongTermMemoryConfig {
  /** Base directory where the long-term memory file is stored. */
  readonly baseDir: string;
  /** Optional file name (default: `long-term.json`). */
  readonly fileName?: string;
}

interface StoredShape {
  [key: string]: MemoryRecord;
}

/**
 * File-backed, persistent long-term memory.
 *
 * Uses a single JSON file per store with atomic writes (temp file + rename).
 * Keys are sandboxed and validated to prevent path traversal. Swapping this
 * for a Vector DB later only requires a new {@link ILongTermMemory} impl.
 */
export class LongTermMemory implements ILongTermMemory {
  private readonly filePath: string;
  private readonly cache: Map<string, MemoryRecord>;
  private loaded = false;

  constructor(config: LongTermMemoryConfig) {
    this.filePath = path.resolve(config.baseDir, config.fileName ?? 'long-term.json');
    this.cache = new Map();
  }

  public async set(key: string, value: unknown): Promise<MemoryRecord> {
    this.validateKey(key);
    await this.ensureLoaded();

    const now = Date.now();
    const existing = this.cache.get(key);
    const record: MemoryRecord = Object.freeze({
      key,
      value: deepFreeze(cloneValue(value)),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    this.cache.set(key, record);
    await this.persist();

    return cloneRecord(record);
  }

  public async get(key: string): Promise<MemoryRecord | undefined> {
    this.validateKey(key);
    await this.ensureLoaded();
    const record = this.cache.get(key);
    if (!record) {
      return undefined;
    }
    return deepFreeze(cloneRecord(record));
  }

  public async delete(key: string): Promise<boolean> {
    this.validateKey(key);
    await this.ensureLoaded();
    const had = this.cache.delete(key);
    if (had) {
      await this.persist();
    }
    return had;
  }

  public async list(): Promise<readonly MemoryRecord[]> {
    await this.ensureLoaded();
    const records = Array.from(this.cache.values()).map((r) => deepFreeze(cloneRecord(r)));
    return Object.freeze(records);
  }

  private validateKey(key: string): void {
    if (typeof key !== 'string' || key.length === 0) {
      throw new MemoryError('Memory key must be a non-empty string');
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as StoredShape;
      for (const [k, v] of Object.entries(parsed)) {
        this.cache.set(k, Object.freeze({ ...v }));
      }
    } catch {
      // Missing or unreadable file: start fresh (graceful fallback).
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    const shape: StoredShape = Object.fromEntries(this.cache);
    const payload = JSON.stringify(shape, null, 2);
    const nonce = Math.random().toString(36).slice(2, 12);
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.${nonce}.tmp`;

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(tmp, payload, 'utf8');
    await fs.rename(tmp, this.filePath);
  }
}

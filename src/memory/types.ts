/**
 * Core types, interfaces, and helpers for the Cupaw multi-level memory system.
 *
 * Design principles:
 * - Strict separation between short-term (session-scoped, in-memory) and
 *   long-term (persistent) storage mechanisms.
 * - Interface-based design so implementations (including future Vector DBs)
 *   can be swapped without touching core logic.
 * - All read/retrieved data is recursively frozen (immutability).
 */

/**
 * A single memory note attached to a project (architectural note, preference, etc.).
 */
export interface MemoryNote {
  readonly noteId: string;
  readonly category: string;
  readonly content: string;
  readonly createdAt: number;
}

/**
 * Persistent, project-level context aggregated across sessions.
 */
export interface ProjectContext {
  readonly projectId: string;
  readonly name: string;
  readonly notes: readonly MemoryNote[];
  readonly preferences: Readonly<Record<string, unknown>>;
  readonly architecturalDecisions: readonly string[];
  readonly updatedAt: number;
}

/**
 * A stored memory record (short or long term).
 */
export interface MemoryRecord<T = unknown> {
  readonly key: string;
  readonly value: T;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/**
 * Bundle of memory subsystems wired into a workspace.
 */
export interface MemoryBundle {
  readonly shortTerm: IShortTermMemory;
  readonly longTerm?: ILongTermMemory;
  readonly projectContext?: IProjectContextStore;
}

/**
 * Short-term (session-scoped, in-memory) memory contract.
 */
export interface IShortTermMemory {
  set(sessionId: string, key: string, value: unknown): MemoryRecord;
  get(sessionId: string, key: string): MemoryRecord | undefined;
  delete(sessionId: string, key: string): boolean;
  list(sessionId: string): readonly MemoryRecord[];
  clear(sessionId: string): void;
}

/**
 * Long-term (persistent) memory contract.
 */
export interface ILongTermMemory {
  set(key: string, value: unknown): Promise<MemoryRecord>;
  get(key: string): Promise<MemoryRecord | undefined>;
  delete(key: string): Promise<boolean>;
  list(): Promise<readonly MemoryRecord[]>;
}

/**
 * Project-level persistent context contract.
 */
export interface IProjectContextStore {
  saveContext(context: ProjectContext): Promise<ProjectContext>;
  loadContext(projectId: string): Promise<ProjectContext | undefined>;
  addNote(projectId: string, category: string, content: string): Promise<MemoryNote>;
  getNotes(projectId: string): Promise<readonly MemoryNote[]>;
  setPreference(projectId: string, key: string, value: unknown): Promise<Readonly<Record<string, unknown>>>;
  getPreferences(projectId: string): Promise<Readonly<Record<string, unknown>>>;
  addArchitecturalDecision(projectId: string, decision: string): Promise<readonly string[]>;
}

/**
 * Base class for memory-related errors.
 */
export class MemoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MemoryError';
  }
}

/**
 * Thrown when a memory key is not found.
 */
export class MemoryKeyNotFoundError extends MemoryError {
  public readonly key: string;

  constructor(key: string) {
    super(`Memory key not found: ${key}`);
    this.name = 'MemoryKeyNotFoundError';
    this.key = key;
  }
}

/**
 * Thrown when a project id or path attempts traversal outside the sandbox.
 */
export class PathTraversalError extends MemoryError {
  public readonly attemptedPath: string;

  constructor(attemptedPath: string) {
    super(`Path traversal detected and blocked: ${attemptedPath}`);
    this.name = 'PathTraversalError';
    this.attemptedPath = attemptedPath;
  }
}

/**
 * Recursively freezes a value and all nested objects/arrays.
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
  for (const k of Object.keys(record)) {
    const child = record[k];
    if (child !== null && typeof child === 'object') {
      deepFreeze(child);
    }
  }
  return value;
}

/**
 * Produces a deep clone of a plain JSON-serializable value.
 * Keeps stored memory values detached from caller references (immutability).
 */
export function cloneValue<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Clones a memory record so returned data is detached and safe to freeze.
 */
export function cloneRecord(record: MemoryRecord): MemoryRecord {
  return {
    key: record.key,
    value: cloneValue(record.value),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

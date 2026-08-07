import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  type IProjectContextStore,
  type ProjectContext,
  type MemoryNote,
  deepFreeze,
  cloneValue,
  PathTraversalError,
} from './types.js';

/**
 * Configuration for {@link ProjectContextStore}.
 */
export interface ProjectContextStoreConfig {
  /** Base directory where project context files are stored. */
  readonly baseDir: string;
}

const DEFAULT_NAME = 'default-project';

interface ProjectFileShape {
  context: ProjectContext;
}

/**
 * File-backed, project-level persistent context store.
 *
 * One JSON file per project under `<baseDir>/projects/<projectId>.json`.
 * Project ids are validated against path traversal. All returned context and
 * notes are recursively frozen.
 */
export class ProjectContextStore implements IProjectContextStore {
  private readonly baseDir: string;

  constructor(config: ProjectContextStoreConfig) {
    this.baseDir = path.resolve(config.baseDir);
  }

  public async saveContext(context: ProjectContext): Promise<ProjectContext> {
    const safe = this.sanitizeId(context.projectId);
    const frozen = deepFreeze(cloneValue(context)) as ProjectContext;
    await this.writeProjectFile(safe, frozen);
    return deepFreeze(cloneValue(frozen)) as ProjectContext;
  }

  public async loadContext(projectId: string): Promise<ProjectContext | undefined> {
    const safe = this.sanitizeId(projectId);
    const parsed = await this.readProjectFile(safe);
    if (!parsed) {
      return undefined;
    }
    return deepFreeze(cloneValue(parsed.context)) as ProjectContext;
  }

  public async addNote(projectId: string, category: string, content: string): Promise<MemoryNote> {
    const safe = this.sanitizeId(projectId);
    const context = await this.readOrCreate(safe);
    const now = Date.now();
    const note: MemoryNote = Object.freeze({
      noteId: `note-${safe}-${now}-${Math.random().toString(36).slice(2, 8)}`,
      category,
      content,
      createdAt: now,
    });

    const updated: ProjectContext = {
      ...context,
      notes: Object.freeze([...context.notes, note]),
      updatedAt: now,
    };
    await this.writeProjectFile(safe, updated);

    return deepFreeze(cloneValue(note)) as MemoryNote;
  }

  public async getNotes(projectId: string): Promise<readonly MemoryNote[]> {
    const safe = this.sanitizeId(projectId);
    const context = await this.readOrCreate(safe);
    return deepFreeze(cloneValue(context.notes)) as readonly MemoryNote[];
  }

  public async setPreference(projectId: string, key: string, value: unknown): Promise<Readonly<Record<string, unknown>>> {
    const safe = this.sanitizeId(projectId);
    const context = await this.readOrCreate(safe);
    const preferences = { ...context.preferences, [key]: value };
    const updated: ProjectContext = {
      ...context,
      preferences: Object.freeze(preferences),
      updatedAt: Date.now(),
    };
    await this.writeProjectFile(safe, updated);
    return deepFreeze(cloneValue(preferences)) as Readonly<Record<string, unknown>>;
  }

  public async getPreferences(projectId: string): Promise<Readonly<Record<string, unknown>>> {
    const safe = this.sanitizeId(projectId);
    const context = await this.readOrCreate(safe);
    return deepFreeze(cloneValue(context.preferences)) as Readonly<Record<string, unknown>>;
  }

  public async addArchitecturalDecision(projectId: string, decision: string): Promise<readonly string[]> {
    const safe = this.sanitizeId(projectId);
    const context = await this.readOrCreate(safe);
    const decisions = Object.freeze([...context.architecturalDecisions, decision]);
    const updated: ProjectContext = {
      ...context,
      architecturalDecisions: decisions,
      updatedAt: Date.now(),
    };
    await this.writeProjectFile(safe, updated);
    return deepFreeze(cloneValue(decisions)) as readonly string[];
  }

  private sanitizeId(projectId: string): string {
    if (typeof projectId !== 'string' || projectId.length === 0) {
      return DEFAULT_NAME;
    }
    if (!/^[A-Za-z0-9._-]+$/.test(projectId)) {
      throw new PathTraversalError(projectId);
    }
    return projectId;
  }

  private async readOrCreate(projectId: string): Promise<ProjectContext> {
    const parsed = await this.readProjectFile(projectId);
    if (parsed) {
      return parsed.context;
    }
    const now = Date.now();
    return Object.freeze({
      projectId,
      name: projectId,
      notes: Object.freeze([]),
      preferences: Object.freeze({}),
      architecturalDecisions: Object.freeze([]),
      updatedAt: now,
    });
  }

  private async readProjectFile(projectId: string): Promise<ProjectFileShape | undefined> {
    const filePath = this.projectFilePath(projectId);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw) as ProjectFileShape;
    } catch {
      return undefined;
    }
  }

  private async writeProjectFile(projectId: string, context: ProjectContext): Promise<void> {
    const filePath = this.projectFilePath(projectId);
    const shape: ProjectFileShape = { context };
    const payload = JSON.stringify(shape, null, 2);
    const nonce = Math.random().toString(36).slice(2, 12);
    const tmp = `${filePath}.${process.pid}.${Date.now()}.${nonce}.tmp`;

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(tmp, payload, 'utf8');
    await fs.rename(tmp, filePath);
  }

  private projectFilePath(projectId: string): string {
    const base = path.resolve(this.baseDir);
    const target = path.resolve(base, 'projects', `${projectId}.json`);
    const baseWithSep = `${base}${path.sep}`;
    if (target !== base && !target.startsWith(baseWithSep)) {
      throw new PathTraversalError(projectId);
    }
    return target;
  }
}

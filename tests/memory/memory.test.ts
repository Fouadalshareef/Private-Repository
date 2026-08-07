import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ShortTermMemory } from '../../src/memory/short-term-memory.js';
import { LongTermMemory } from '../../src/memory/long-term-memory.js';
import { ProjectContextStore } from '../../src/memory/project-context-store.js';
import { MemoryError, PathTraversalError } from '../../src/memory/types.js';
import { ConversationRegistry } from '../../src/conversation/ConversationRegistry.js';
import { ConversationWorkspace } from '../../src/conversation/ConversationWorkspace.js';
import { ConversationRuntime } from '../../src/conversation/ConversationRuntime.js';
import { AdvisorCLIController } from '../../src/cli/handlers/AdvisorCLIController.js';
import type { MemoryBundle } from '../../src/memory/types.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'cupaw-mem-'));
}

describe('ShortTermMemory (unit)', () => {
  let mem: ShortTermMemory;

  beforeEach(() => {
    mem = new ShortTermMemory();
  });

  it('sets and gets a record for a session', () => {
    const rec = mem.set('s1', 'goal', 'build API');
    expect(rec.key).toBe('goal');
    expect(rec.value).toBe('build API');
    expect(mem.get('s1', 'goal')?.value).toBe('build API');
  });

  it('scopes records per session', () => {
    mem.set('s1', 'k', 'v1');
    mem.set('s2', 'k', 'v2');
    expect(mem.get('s1', 'k')?.value).toBe('v1');
    expect(mem.get('s2', 'k')?.value).toBe('v2');
  });

  it('returns undefined for unknown keys', () => {
    expect(mem.get('s1', 'nope')).toBeUndefined();
  });

  it('deletes a record', () => {
    mem.set('s1', 'k', 'v');
    expect(mem.delete('s1', 'k')).toBe(true);
    expect(mem.get('s1', 'k')).toBeUndefined();
    expect(mem.delete('s1', 'missing')).toBe(false);
  });

  it('lists and clears session records', () => {
    mem.set('s1', 'a', 1);
    mem.set('s1', 'b', 2);
    expect(mem.list('s1')).toHaveLength(2);
    mem.clear('s1');
    expect(mem.list('s1')).toHaveLength(0);
  });

  it('returns frozen records and isolates stored values (immutability)', () => {
    const obj = { nested: { a: 1 } };
    mem.set('s1', 'obj', obj);
    // Mutating the caller's original object must NOT affect the stored copy.
    obj.nested.a = 999;
    const rec = mem.get('s1', 'obj')!;
    expect(Object.isFrozen(rec)).toBe(true);
    expect(Object.isFrozen(rec.value)).toBe(true);
    expect((rec.value as { nested: { a: number } }).nested.a).toBe(1);
  });
});

describe('LongTermMemory (unit)', () => {
  let dir: string;
  let store: LongTermMemory;

  beforeEach(async () => {
    dir = await makeTempDir();
    store = new LongTermMemory({ baseDir: dir });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('sets, gets, and lists records', async () => {
    await store.set('arch', { pattern: 'hexagonal' });
    const rec = await store.get('arch');
    expect(rec?.value).toEqual({ pattern: 'hexagonal' });
    expect((await store.list())).toHaveLength(1);
  });

  it('persists across instances (file-backed)', async () => {
    await store.set('pref', 'dark-mode');
    const store2 = new LongTermMemory({ baseDir: dir });
    const rec = await store2.get('pref');
    expect(rec?.value).toBe('dark-mode');
  });

  it('updates updatedAt on overwrite but keeps createdAt', async () => {
    const first = await store.set('k', 1);
    const second = await store.set('k', 2);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);
  });

  it('deletes records', async () => {
    await store.set('k', 1);
    expect(await store.delete('k')).toBe(true);
    expect(await store.get('k')).toBeUndefined();
    expect(await store.delete('k')).toBe(false);
  });

  it('returns a frozen record (immutability)', async () => {
    await store.set('k', { x: 1 });
    const rec = await store.get('k');
    expect(Object.isFrozen(rec)).toBe(true);
    expect(Object.isFrozen(rec?.value)).toBe(true);
  });

  it('rejects empty keys', async () => {
    await expect(store.set('', 'v')).rejects.toBeInstanceOf(MemoryError);
  });

  it('writes atomically without leaving temp files', async () => {
    await store.set('k', 'v');
    const files = await fs.readdir(dir);
    expect(files).toContain('long-term.json');
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false);
  });
});

describe('ProjectContextStore (unit)', () => {
  let dir: string;
  let store: ProjectContextStore;

  beforeEach(async () => {
    dir = await makeTempDir();
    store = new ProjectContextStore({ baseDir: dir });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('adds and reads notes', async () => {
    await store.addNote('proj-x', 'architecture', 'use events');
    const notes = await store.getNotes('proj-x');
    expect(notes).toHaveLength(1);
    expect(notes[0].category).toBe('architecture');
    expect(notes[0].content).toBe('use events');
  });

  it('persists notes across instances', async () => {
    await store.addNote('proj-x', 'general', 'note one');
    const store2 = new ProjectContextStore({ baseDir: dir });
    const notes = await store2.getNotes('proj-x');
    expect(notes).toHaveLength(1);
  });

  it('sets and reads preferences', async () => {
    await store.setPreference('proj-x', 'theme', 'dark');
    const prefs = await store.getPreferences('proj-x');
    expect(prefs.theme).toBe('dark');
  });

  it('appends architectural decisions', async () => {
    const decisions = await store.addArchitecturalDecision('proj-x', 'use CQRS');
    expect(decisions).toContain('use CQRS');
  });

  it('round-trips full context', async () => {
    await store.addNote('proj-x', 'general', 'n');
    await store.setPreference('proj-x', 'lang', 'ts');
    const ctx = await store.loadContext('proj-x');
    expect(ctx?.projectId).toBe('proj-x');
    expect(ctx?.notes).toHaveLength(1);
    expect(ctx?.preferences.lang).toBe('ts');
  });

  it('returns a frozen context (immutability)', async () => {
    await store.addNote('proj-x', 'general', 'n');
    const ctx = await store.loadContext('proj-x');
    expect(Object.isFrozen(ctx)).toBe(true);
    expect(Object.isFrozen(ctx?.notes)).toBe(true);
  });

  it('blocks path traversal in project ids', async () => {
    await expect(store.addNote('../escape', 'general', 'x')).rejects.toBeInstanceOf(PathTraversalError);
  });
});

describe('Memory integration with ConversationWorkspace', () => {
  let dir: string;
  let bundle: MemoryBundle;

  beforeEach(async () => {
    dir = await makeTempDir();
    bundle = {
      shortTerm: new ShortTermMemory(),
      longTerm: new LongTermMemory({ baseDir: dir }),
      projectContext: new ProjectContextStore({ baseDir: dir }),
    };
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('remembers and recalls within a session', () => {
    const registry = new ConversationRegistry();
    const wsMeta = registry.createWorkspace('proj', 'My Project');
    const workspace = new ConversationWorkspace({ registry, workspaceId: wsMeta.workspaceId, memory: bundle });
    workspace.createSession('advisor-1');

    workspace.remember('goal', 'ship v1');
    const rec = workspace.recall('goal');
    expect(rec?.value).toBe('ship v1');
    expect(workspace.listMemory()).toHaveLength(1);
  });

  it('forgets a memory entry', () => {
    const registry = new ConversationRegistry();
    const wsMeta = registry.createWorkspace('proj', 'My Project');
    const workspace = new ConversationWorkspace({ registry, workspaceId: wsMeta.workspaceId, memory: bundle });
    workspace.createSession('advisor-1');

    workspace.remember('k', 'v');
    expect(workspace.forget('k')).toBe(true);
    expect(workspace.recall('k')).toBeUndefined();
  });

  it('persists project notes and context across instances', async () => {
    const registry = new ConversationRegistry();
    const wsMeta = registry.createWorkspace('proj', 'My Project');
    const workspace = new ConversationWorkspace({ registry, workspaceId: wsMeta.workspaceId, memory: bundle });
    workspace.createSession('advisor-1');

    await workspace.addProjectNote('favor composition over inheritance', 'architecture');

    // New store instances reading the same directory see the persisted note.
    const verifyStore = new ProjectContextStore({ baseDir: dir });
    const notes = await verifyStore.getNotes('proj');
    expect(notes).toHaveLength(1);
    expect(notes[0].content).toBe('favor composition over inheritance');
  });

  it('throws when no memory bundle is attached', () => {
    const registry = new ConversationRegistry();
    const wsMeta = registry.createWorkspace('proj', 'My Project');
    const workspace = new ConversationWorkspace({ registry, workspaceId: wsMeta.workspaceId });
    workspace.createSession('advisor-1');

    expect(() => workspace.remember('k', 'v')).toThrow();
  });
});

describe('Memory integration with AdvisorCLIController', () => {
  let dir: string;
  let bundle: MemoryBundle;

  beforeEach(async () => {
    dir = await makeTempDir();
    bundle = {
      shortTerm: new ShortTermMemory(),
      longTerm: new LongTermMemory({ baseDir: dir }),
      projectContext: new ProjectContextStore({ baseDir: dir }),
    };
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('supports /remember and /recall commands', () => {
    const registry = new ConversationRegistry();
    const runtime = new ConversationRuntime({ registry });
    const controller = new AdvisorCLIController(runtime, bundle);

    const rememberOut = controller.handleCommand('/remember token secret-value') as { kind: 'remember'; value: { key: string; value: unknown } };
    expect(rememberOut.kind).toBe('remember');
    expect(rememberOut.value.key).toBe('token');
    expect(rememberOut.value.value).toBe('secret-value');

    const recallOut = controller.handleCommand('/recall token') as { kind: 'recall'; value: { found: boolean; value: unknown } };
    expect(recallOut.kind).toBe('recall');
    expect(recallOut.value.found).toBe(true);
    expect(recallOut.value.value).toBe('secret-value');
  });

  it('reports not-found for missing keys via /recall', () => {
    const registry = new ConversationRegistry();
    const runtime = new ConversationRuntime({ registry });
    const controller = new AdvisorCLIController(runtime, bundle);

    const recallOut = controller.handleCommand('/recall missing') as { kind: 'recall'; value: { found: boolean } };
    expect(recallOut.value.found).toBe(false);
  });
});

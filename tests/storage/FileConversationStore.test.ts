import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FileConversationStore } from '../../src/storage/FileConversationStore.js';
import { CorruptedSessionError, PathTraversalError } from '../../src/storage/types/StorageTypes.js';
import { createAdvisorSession, type AdvisorSession } from '../../src/conversation/AdvisorSession.js';
import { ConversationSessionStatus } from '../../src/conversation/ConversationState.js';
import { ConversationRegistry } from '../../src/conversation/ConversationRegistry.js';
import { ConversationRuntime } from '../../src/conversation/ConversationRuntime.js';
import { AdvisorCLIController } from '../../src/cli/handlers/AdvisorCLIController.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'cupaw-store-'));
}

function makeSession(overrides: Partial<AdvisorSession> = {}): AdvisorSession {
  return createAdvisorSession({
    sessionId: 'session-test-1',
    workspaceId: 'workspace-test-1',
    advisorId: 'software-engineer',
    messages: Object.freeze([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ]),
    createdAt: 1000,
    updatedAt: 2000,
    metadata: Object.freeze({ source: 'cli', nested: { a: 1 } }),
    status: ConversationSessionStatus.ACTIVE,
    lastActivity: 2000,
    ...overrides,
  });
}

describe('FileConversationStore', () => {
  let dir: string;
  let store: FileConversationStore;

  beforeEach(async () => {
    dir = await makeTempDir();
    store = new FileConversationStore({ baseDir: dir });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  describe('saveSession / loadSession (payload integrity)', () => {
    it('should create the base directory automatically and persist a session', async () => {
      const session = makeSession();
      await store.saveSession(session);

      const filePath = path.join(dir, 'session-test-1.json');
      const exists = await fs.stat(filePath).catch(() => null);
      expect(exists).not.toBeNull();
    });

    it('should round-trip a session with full payload integrity', async () => {
      const session = makeSession();
      await store.saveSession(session);

      const loaded = await store.loadSession('session-test-1');
      expect(loaded.sessionId).toBe(session.sessionId);
      expect(loaded.workspaceId).toBe(session.workspaceId);
      expect(loaded.advisorId).toBe(session.advisorId);
      expect(loaded.messages).toEqual(session.messages);
      expect(loaded.metadata).toEqual(session.metadata);
      expect(loaded.status).toBe(session.status);
      expect(loaded.summary).toBe(session.summary);
      expect(loaded.createdAt).toBe(session.createdAt);
      expect(loaded.updatedAt).toBe(session.updatedAt);
      expect(loaded.lastActivity).toBe(session.lastActivity);
    });

    it('should overwrite an existing session file on re-save', async () => {
      await store.saveSession(makeSession());
      const updated = makeSession({ advisorId: 'ui-designer', messages: Object.freeze([{ role: 'user', content: 'x' }]) });
      await store.saveSession(updated);

      const loaded = await store.loadSession('session-test-1');
      expect(loaded.advisorId).toBe('ui-designer');
      expect(loaded.messages).toHaveLength(1);
    });

    it('should write atomically without leaving a temp file', async () => {
      await store.saveSession(makeSession());
      const files = await fs.readdir(dir);
      expect(files).toContain('session-test-1.json');
      expect(files.some((f) => f.endsWith('.tmp'))).toBe(false);
    });
  });

  describe('immutability', () => {
    it('should return a recursively frozen session on load', async () => {
      await store.saveSession(makeSession());
      const loaded = await store.loadSession('session-test-1');

      expect(Object.isFrozen(loaded)).toBe(true);
      expect(Object.isFrozen(loaded.messages)).toBe(true);
      expect(Object.isFrozen(loaded.metadata)).toBe(true);
    });
  });

  describe('corrupted JSON recovery / isolation', () => {
    it('should throw CorruptedSessionError when loading a malformed file', async () => {
      const filePath = path.join(dir, 'session-bad.json');
      await fs.writeFile(filePath, '{ this is : not valid json', 'utf8');

      await expect(store.loadSession('session-bad')).rejects.toBeInstanceOf(CorruptedSessionError);
    });

    it('should throw CorruptedSessionError when the file is missing', async () => {
      await expect(store.loadSession('session-missing')).rejects.toBeInstanceOf(CorruptedSessionError);
    });

    it('should isolate corrupted files when listing sessions', async () => {
      await store.saveSession(makeSession());
      await fs.writeFile(path.join(dir, 'session-bad.json'), '{{{ broken', 'utf8');

      const entries = await store.listSessions();
      expect(entries).toHaveLength(1);
      expect(entries[0].sessionId).toBe('session-test-1');
    });

    it('should skip non-JSON files during listing', async () => {
      await store.saveSession(makeSession());
      await fs.writeFile(path.join(dir, 'notes.txt'), 'ignore me', 'utf8');

      const entries = await store.listSessions();
      expect(entries).toHaveLength(1);
    });
  });

  describe('listSessions / deleteSession', () => {
    it('should list sessions and filter by workspace', async () => {
      await store.saveSession(makeSession({ sessionId: 'session-a', workspaceId: 'ws-1' }));
      await store.saveSession(makeSession({ sessionId: 'session-b', workspaceId: 'ws-2' }));

      const all = await store.listSessions();
      expect(all).toHaveLength(2);

      const ws1 = await store.listSessions('ws-1');
      expect(ws1).toHaveLength(1);
      expect(ws1[0].sessionId).toBe('session-a');
    });

    it('should delete a session and return true', async () => {
      await store.saveSession(makeSession());
      const deleted = await store.deleteSession('session-test-1');
      expect(deleted).toBe(true);

      const entries = await store.listSessions();
      expect(entries).toHaveLength(0);
    });

    it('should return false when deleting a missing session', async () => {
      const deleted = await store.deleteSession('session-nope');
      expect(deleted).toBe(false);
    });
  });

  describe('pruneSessions', () => {
    it('should purge sessions older than maxAgeMs', async () => {
      const old = makeSession({ sessionId: 'session-old', updatedAt: Date.now() - 10_000, lastActivity: Date.now() - 10_000 });
      const recent = makeSession({ sessionId: 'session-recent', updatedAt: Date.now(), lastActivity: Date.now() });
      await store.saveSession(old);
      await store.saveSession(recent);

      const result = await store.pruneSessions({ maxAgeMs: 5000 });
      expect(result.purged).toContain('session-old');
      expect(result.purged).not.toContain('session-recent');
      expect(result.remaining).toBe(1);
    });

    it('should keep only the most recent maxCount sessions', async () => {
      for (let i = 0; i < 5; i++) {
        await store.saveSession(
          makeSession({ sessionId: `session-${i}`, updatedAt: 1000 + i, lastActivity: 1000 + i }),
        );
      }

      const result = await store.pruneSessions({ maxCount: 2 });
      expect(result.purged).toHaveLength(3);
      expect(result.remaining).toBe(2);
    });
  });

  describe('path safety', () => {
    it('should block path-traversal session ids on save', async () => {
      const evil = makeSession({ sessionId: '../escape' });
      await expect(store.saveSession(evil)).rejects.toBeInstanceOf(PathTraversalError);
    });

    it('should block path-traversal session ids on load', async () => {
      await expect(store.loadSession('../../etc/passwd')).rejects.toBeInstanceOf(PathTraversalError);
    });

    it('should block session ids containing separators', async () => {
      const evil = makeSession({ sessionId: 'a/b' });
      await expect(store.saveSession(evil)).rejects.toBeInstanceOf(PathTraversalError);
    });
  });
});

describe('ConversationRuntime + FileConversationStore integration', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('hydrates previous sessions into a workspace on startup', async () => {
    const store = new FileConversationStore({ baseDir: dir });
    const registry = new ConversationRegistry();
    const runtime = new ConversationRuntime({ registry, store });

    const workspace = runtime.createWorkspace('proj', 'My Project');
    const workspaceId = workspace.workspaceId;

    const session = makeSession({ workspaceId, sessionId: 'session-seed-1' });
    await store.saveSession(session);

    const restored = await runtime.hydrateWorkspace(workspaceId);
    expect(restored).toBe(1);
    expect(workspace.getCurrentSession()?.sessionId).toBe('session-seed-1');
  });

  it('persists new sessions during interaction via AdvisorCLIController', async () => {
    const store = new FileConversationStore({ baseDir: dir });
    const registry = new ConversationRegistry();
    const runtime = new ConversationRuntime({ registry, store });
    const controller = new AdvisorCLIController(runtime);

    controller.switchAdvisor('security-advisor');
    const sessionId = controller.getActiveAdvisor().sessionId;
    expect(sessionId).toBeDefined();
    await controller.persist();

    const loaded = await store.loadSession(sessionId!);
    expect(loaded.advisorId).toBe('security-advisor');
  });

  it('prunes stored sessions through the runtime', async () => {
    const store = new FileConversationStore({ baseDir: dir });
    const registry = new ConversationRegistry();
    const runtime = new ConversationRuntime({ registry, store });
    runtime.createWorkspace('proj', 'P');

    for (let i = 0; i < 3; i++) {
      await store.saveSession(makeSession({ sessionId: `session-${i}`, updatedAt: 1000 + i, lastActivity: 1000 + i }));
    }

    const result = await runtime.pruneStoredSessions({ maxCount: 1 });
    expect(result.purged).toHaveLength(2);
    expect(result.remaining).toBe(1);
  });
});

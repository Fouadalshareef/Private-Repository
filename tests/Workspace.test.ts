import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Workspace } from '../src/workspace/Workspace.js';
import { WorkspaceState } from '../src/workspace/WorkspaceState.js';
import {
  WorkspaceError,
  WorkspaceCreationError,
  WorkspaceOpenError,
  WorkspaceCloseError,
} from '../src/workspace/WorkspaceError.js';
import { WorkspaceEvents } from '../src/workspace/WorkspaceEvents.js';
import type { IWorkspace } from '../src/workspace/IWorkspace.js';
import type { WorkspaceInfo } from '../src/workspace/WorkspaceInfo.js';

describe('Workspace', () => {
  let workspace: Workspace;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T00:00:00.000Z'));
    workspace = new Workspace();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── workspace creation ───────────────────────────────────────

  it('should create a workspace', () => {
    workspace.create('ws-1', 'My Project', '/path/to/project');

    expect(workspace.getState()).toBe(WorkspaceState.CLOSED);
    expect(workspace.getRoot()).toBe('/path/to/project');
  });

  it('should create a workspace with correct info', () => {
    const fixedTime = Date.now();
    workspace.create('ws-1', 'My Project', '/path/to/project');

    const info = workspace.getInfo();
    expect(info.id).toBe('ws-1');
    expect(info.name).toBe('My Project');
    expect(info.rootPath).toBe('/path/to/project');
    expect(info.createdAt).toBe(fixedTime);
    expect(info.openedAt).toBeUndefined();
    expect(info.version).toBeDefined();
  });

  it('should throw WorkspaceCreationError when creating twice', () => {
    workspace.create('ws-1', 'My Project', '/path/to/project');
    expect(() => workspace.create('ws-2', 'Other', '/other/path')).toThrow(
      WorkspaceCreationError,
    );
  });

  it('should throw WorkspaceCreationError when id is empty', () => {
    expect(() => workspace.create('', 'My Project', '/path/to/project')).toThrow(
      WorkspaceCreationError,
    );
  });

  it('should throw WorkspaceCreationError when id is whitespace only', () => {
    expect(() => workspace.create('   ', 'My Project', '/path/to/project')).toThrow(
      WorkspaceCreationError,
    );
  });

  it('should throw WorkspaceCreationError when name is empty', () => {
    expect(() => workspace.create('ws-1', '', '/path/to/project')).toThrow(
      WorkspaceCreationError,
    );
  });

  it('should throw WorkspaceCreationError when name is whitespace only', () => {
    expect(() => workspace.create('ws-1', '   ', '/path/to/project')).toThrow(
      WorkspaceCreationError,
    );
  });

  it('should throw WorkspaceCreationError when rootPath is empty', () => {
    expect(() => workspace.create('ws-1', 'My Project', '')).toThrow(
      WorkspaceCreationError,
    );
  });

  it('should throw WorkspaceCreationError when rootPath is whitespace only', () => {
    expect(() => workspace.create('ws-1', 'My Project', '   ')).toThrow(
      WorkspaceCreationError,
    );
  });

  it('should throw a meaningful error message for invalid creation', () => {
    try {
      workspace.create('ws-1', 'My Project', '');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(WorkspaceCreationError);
      expect((error as Error).message).toContain('rootPath');
    }
  });

  // ── open ─────────────────────────────────────────────────────

  it('should open a created workspace', () => {
    workspace.create('ws-1', 'My Project', '/path/to/project');

    workspace.open();

    expect(workspace.getState()).toBe(WorkspaceState.OPEN);
    expect(workspace.isOpen()).toBe(true);
  });

  it('should set openedAt when opening', () => {
    workspace.create('ws-1', 'My Project', '/path/to/project');
    expect(workspace.getInfo().openedAt).toBeUndefined();

    workspace.open();

    expect(workspace.getInfo().openedAt).toBe(Date.now());
  });

  it('should throw WorkspaceOpenError when opening before creation', () => {
    expect(() => workspace.open()).toThrow(WorkspaceOpenError);
  });

  it('should throw WorkspaceOpenError when opening an already-open workspace', () => {
    workspace.create('ws-1', 'My Project', '/path/to/project');
    workspace.open();

    expect(() => workspace.open()).toThrow(WorkspaceOpenError);
  });

  it('should throw a meaningful error when opening before creation', () => {
    try {
      workspace.open();
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(WorkspaceOpenError);
      expect((error as Error).message).toContain('created');
    }
  });

  // ── close ────────────────────────────────────────────────────

  it('should close an open workspace', () => {
    workspace.create('ws-1', 'My Project', '/path/to/project');
    workspace.open();

    workspace.close();

    expect(workspace.getState()).toBe(WorkspaceState.CLOSED);
    expect(workspace.isOpen()).toBe(false);
  });

  it('should throw WorkspaceCloseError when closing before creation', () => {
    expect(() => workspace.close()).toThrow(WorkspaceCloseError);
  });

  it('should throw WorkspaceCloseError when closing a non-open workspace', () => {
    workspace.create('ws-1', 'My Project', '/path/to/project');

    expect(() => workspace.close()).toThrow(WorkspaceCloseError);
  });

  it('should throw a meaningful error when closing a non-open workspace', () => {
    workspace.create('ws-1', 'My Project', '/path/to/project');
    try {
      workspace.close();
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(WorkspaceCloseError);
      expect((error as Error).message).toContain('not open');
    }
  });

  // ── state transitions ────────────────────────────────────────

  it('should transition from CLOSED to OPEN to CLOSED', () => {
    workspace.create('ws-1', 'My Project', '/path/to/project');
    expect(workspace.getState()).toBe(WorkspaceState.CLOSED);

    workspace.open();
    expect(workspace.getState()).toBe(WorkspaceState.OPEN);

    workspace.close();
    expect(workspace.getState()).toBe(WorkspaceState.CLOSED);
  });

  it('should support reopening after closing', () => {
    workspace.create('ws-1', 'My Project', '/path/to/project');
    workspace.open();
    workspace.close();

    workspace.open();
    expect(workspace.isOpen()).toBe(true);
  });

  it('should be closed initially', () => {
    expect(workspace.getState()).toBe(WorkspaceState.CLOSED);
    expect(workspace.isOpen()).toBe(false);
  });

  // ── workspace info ───────────────────────────────────────────

  it('should return info after creation', () => {
    workspace.create('ws-1', 'My Project', '/path/to/project');

    const info = workspace.getInfo();
    expect(info).toEqual({
      id: 'ws-1',
      name: 'My Project',
      rootPath: '/path/to/project',
      createdAt: Date.now(),
      openedAt: undefined,
      version: expect.any(String),
    });
  });

  it('should throw WorkspaceError when getting info before creation', () => {
    expect(() => workspace.getInfo()).toThrow(WorkspaceError);
  });

  it('should throw WorkspaceError when getting root before creation', () => {
    expect(() => workspace.getRoot()).toThrow(WorkspaceError);
  });

  it('should return a copy of info (immutable)', () => {
    workspace.create('ws-1', 'My Project', '/path/to/project');

    const info = workspace.getInfo();
    const mutated = info as { id: string };
    mutated.id = 'mutated';

    expect(workspace.getInfo().id).toBe('ws-1');
  });

  // ── options ──────────────────────────────────────────────────

  it('should default options when none are provided', () => {
    const ws = new Workspace();
    expect(ws.getOptions()).toEqual({});
  });

  it('should keep provided options', () => {
    const ws = new Workspace({ readOnly: true, autoCreate: false, watchChanges: true });
    expect(ws.getOptions()).toEqual({
      readOnly: true,
      autoCreate: false,
      watchChanges: true,
    });
  });

  it('should auto-create when autoCreate is enabled with params', () => {
    const ws = new Workspace(
      { autoCreate: true },
      { id: 'auto-1', name: 'Auto', rootPath: '/auto/path' },
    );

    expect(ws.getState()).toBe(WorkspaceState.CLOSED);
    expect(ws.getInfo().id).toBe('auto-1');
    expect(ws.getRoot()).toBe('/auto/path');
  });

  it('should throw WorkspaceCreationError when autoCreate is enabled without params', () => {
    expect(() => new Workspace({ autoCreate: true })).toThrow(WorkspaceCreationError);
  });

  it('should return a copy of options (immutable)', () => {
    const ws = new Workspace({ readOnly: true });
    const options = ws.getOptions();
    options.readOnly = false;

    expect(ws.getOptions().readOnly).toBe(true);
  });

  // ── errors ───────────────────────────────────────────────────

  it('should have the correct error name for WorkspaceCreationError', () => {
    try {
      workspace.create('', 'My Project', '/path/to/project');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(WorkspaceCreationError);
      expect((error as Error).name).toBe('WorkspaceCreationError');
    }
  });

  it('should have the correct error name for WorkspaceOpenError', () => {
    try {
      workspace.open();
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(WorkspaceOpenError);
      expect((error as Error).name).toBe('WorkspaceOpenError');
    }
  });

  it('should have the correct error name for WorkspaceCloseError', () => {
    workspace.create('ws-1', 'My Project', '/path/to/project');
    try {
      workspace.close();
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(WorkspaceCloseError);
      expect((error as Error).name).toBe('WorkspaceCloseError');
    }
  });

  it('should throw WorkspaceError base type for subclasses', () => {
    expect(() => workspace.create('', 'My Project', '/path/to/project')).toThrow(
      WorkspaceError,
    );
    expect(() => workspace.open()).toThrow(WorkspaceError);
  });

  // ── interface conformance ────────────────────────────────────

  it('should conform to the IWorkspace interface', () => {
    const ws: IWorkspace = workspace;
    expect(ws.create).toBeTypeOf('function');
    expect(ws.open).toBeTypeOf('function');
    expect(ws.close).toBeTypeOf('function');
    expect(ws.isOpen).toBeTypeOf('function');
    expect(ws.getInfo).toBeTypeOf('function');
    expect(ws.getRoot).toBeTypeOf('function');
    expect(ws.getState).toBeTypeOf('function');
  });

  it('should return a WorkspaceInfo typed result', () => {
    workspace.create('ws-1', 'My Project', '/path/to/project');
    const info: WorkspaceInfo = workspace.getInfo();
    expect(info.id).toBe('ws-1');
  });

  // ── events (definitions only) ────────────────────────────────

  it('should define workspace event names', () => {
    expect(WorkspaceEvents.WORKSPACE_CREATED).toBe('workspace.created');
    expect(WorkspaceEvents.WORKSPACE_OPENED).toBe('workspace.opened');
    expect(WorkspaceEvents.WORKSPACE_CLOSED).toBe('workspace.closed');
    expect(WorkspaceEvents.WORKSPACE_ERROR).toBe('workspace.error');
  });
});
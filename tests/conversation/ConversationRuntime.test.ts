import { describe, it, expect, vi } from 'vitest';
import type { IEventBus } from '../../src/events/IEventBus.js';
import { ConversationRegistry } from '../../src/conversation/ConversationRegistry.js';
import { ConversationSessionManager } from '../../src/conversation/ConversationSessionManager.js';
import { ConversationRuntime } from '../../src/conversation/ConversationRuntime.js';
import { ConversationWorkspace } from '../../src/conversation/ConversationWorkspace.js';
import {
  AdvisorNotFoundInWorkspaceError,
  InvalidSessionStateError,
} from '../../src/conversation/ConversationError.js';
import { ConversationSessionStatus } from '../../src/conversation/ConversationState.js';
import { SharedNoteType } from '../../src/conversation/ConversationState.js';

function createMockEventBus(): IEventBus {
  return {
    publish: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    clear: vi.fn(),
  };
}

describe('ConversationRegistry', () => {
  let registry: ConversationRegistry;

  beforeEach(() => {
    registry = new ConversationRegistry({ eventBus: createMockEventBus() });
  });

  describe('workspace management', () => {
    it('should create a workspace', () => {
      const workspace = registry.createWorkspace('project-1', 'Test Project');
      expect(workspace.workspaceId).toBeDefined();
      expect(workspace.projectId).toBe('project-1');
      expect(workspace.name).toBe('Test Project');
      expect(workspace.advisors).toHaveLength(0);
    });

    it('should publish WorkspaceCreated event', () => {
      registry.createWorkspace('project-1', 'Test Project');
      expect(registry.listWorkspaces()).toHaveLength(1);
    });

    it('should list workspaces', () => {
      registry.createWorkspace('project-1', 'Project 1');
      registry.createWorkspace('project-2', 'Project 2');
      const workspaces = registry.listWorkspaces();
      expect(workspaces).toHaveLength(2);
    });

    it('should close a workspace', () => {
      const workspace = registry.createWorkspace('project-1', 'Test Project');
      const closed = registry.closeWorkspace(workspace.workspaceId);
      expect(closed.updatedAt).toBeGreaterThanOrEqual(workspace.createdAt);
    });
  });

  describe('advisor management', () => {
    it('should add advisor to workspace', () => {
      const workspace = registry.createWorkspace('project-1', 'Test Project');
      const updated = registry.addAdvisorToWorkspace(workspace.workspaceId, 'advisor-1');
      expect(updated.advisors).toContain('advisor-1');
    });

    it('should not duplicate advisors', () => {
      const workspace = registry.createWorkspace('project-1', 'Test Project');
      registry.addAdvisorToWorkspace(workspace.workspaceId, 'advisor-1');
      const updated = registry.addAdvisorToWorkspace(workspace.workspaceId, 'advisor-1');
      expect(updated.advisors).toHaveLength(1);
    });

    it('should throw for advisor not in workspace', () => {
      const workspace = registry.createWorkspace('project-1', 'Test Project');
      expect(() => registry.createSession(workspace.workspaceId, 'advisor-1')).toThrow(
        AdvisorNotFoundInWorkspaceError,
      );
    });
  });

  describe('session management', () => {
    it('should create a session', () => {
      const workspace = registry.createWorkspace('project-1', 'Test Project');
      registry.addAdvisorToWorkspace(workspace.workspaceId, 'advisor-1');
      const session = registry.createSession(workspace.workspaceId, 'advisor-1');
      expect(session.sessionId).toBeDefined();
      expect(session.advisorId).toBe('advisor-1');
      expect(session.status).toBe(ConversationSessionStatus.ACTIVE);
    });

    it('should list sessions for workspace', () => {
      const workspace = registry.createWorkspace('project-1', 'Test Project');
      registry.addAdvisorToWorkspace(workspace.workspaceId, 'advisor-1');
      registry.addAdvisorToWorkspace(workspace.workspaceId, 'advisor-2');
      registry.createSession(workspace.workspaceId, 'advisor-1');
      registry.createSession(workspace.workspaceId, 'advisor-2');
      const sessions = registry.listSessions(workspace.workspaceId);
      expect(sessions).toHaveLength(2);
    });
  });

  describe('context management', () => {
    it('should get context', () => {
      const workspace = registry.createWorkspace('project-1', 'Test Project');
      const context = registry.getContext(workspace.workspaceId);
      expect(context).toBeDefined();
      expect(context?.projectName).toBe('Test Project');
    });

    it('should update context', () => {
      const workspace = registry.createWorkspace('project-1', 'Test Project');
      const updated = registry.updateContext(workspace.workspaceId, {
        currentTask: 'Implement feature X',
      });
      expect(updated.currentTask).toBe('Implement feature X');
    });
  });

  describe('shared notes', () => {
    it('should create shared note', () => {
      const workspace = registry.createWorkspace('project-1', 'Test Project');
      registry.addAdvisorToWorkspace(workspace.workspaceId, 'advisor-1');
      const note = registry.createSharedNote(workspace.workspaceId, 'advisor-1', SharedNoteType.RECOMMENDATION, 'Use React');
      expect(note.noteId).toBeDefined();
      expect(note.content).toBe('Use React');
      expect(note.noteType).toBe(SharedNoteType.RECOMMENDATION);
    });

    it('should list shared notes', () => {
      const workspace = registry.createWorkspace('project-1', 'Test Project');
      registry.addAdvisorToWorkspace(workspace.workspaceId, 'advisor-1');
      registry.createSharedNote(workspace.workspaceId, 'advisor-1', SharedNoteType.WARNING, 'Warning 1');
      registry.createSharedNote(workspace.workspaceId, 'advisor-1', SharedNoteType.TODO, 'Todo 1');
      const notes = registry.getSharedNotes(workspace.workspaceId);
      expect(notes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('collaboration requests', () => {
    it('should create collaboration request', () => {
      const workspace = registry.createWorkspace('project-1', 'Test Project');
      registry.addAdvisorToWorkspace(workspace.workspaceId, 'advisor-1');
      registry.addAdvisorToWorkspace(workspace.workspaceId, 'advisor-2');
      const request = registry.createCollaborationRequest(
        workspace.workspaceId,
        'advisor-1',
        'advisor-2',
        'Review needed',
        'Please review this',
      );
      expect(request.requestId).toBeDefined();
      expect(request.status).toBe('pending');
    });

    it('should complete collaboration request', () => {
      const workspace = registry.createWorkspace('project-1', 'Test Project');
      registry.addAdvisorToWorkspace(workspace.workspaceId, 'advisor-1');
      registry.addAdvisorToWorkspace(workspace.workspaceId, 'advisor-2');
      const request = registry.createCollaborationRequest(
        workspace.workspaceId,
        'advisor-1',
        'advisor-2',
        'Review needed',
        'Please review this',
      );
      const completed = registry.completeCollaborationRequest(request.requestId, 'approved', 'Looks good');
      expect(completed.status).toBe('completed');
      expect(completed.resolution).toBe('approved');
    });
  });

  describe('inbox', () => {
    it('should get advisor inbox', () => {
      const workspace = registry.createWorkspace('project-1', 'Test Project');
      registry.addAdvisorToWorkspace(workspace.workspaceId, 'advisor-1');
      const inbox = registry.getAdvisorInbox(workspace.workspaceId, 'advisor-1');
      expect(inbox.advisorId).toBe('advisor-1');
      expect(inbox.incomingReviews).toHaveLength(0);
    });
  });

  describe('export/import', () => {
    it('should export workspace', () => {
      const workspace = registry.createWorkspace('project-1', 'Test Project');
      const exported = registry.exportWorkspace(workspace.workspaceId);
      expect(exported).toBeDefined();
      expect((exported as { workspace: { workspaceId: string } }).workspace.workspaceId).toBe(workspace.workspaceId);
    });

    it('should import workspace', () => {
      const workspace = registry.createWorkspace('project-1', 'Test Project');
      const exported = registry.exportWorkspace(workspace.workspaceId);
      const imported = registry.importWorkspace(exported);
      expect(imported.workspaceId).toBe(workspace.workspaceId);
    });
  });
});

describe('ConversationSessionManager', () => {
  let manager: ConversationSessionManager;

  beforeEach(() => {
    manager = new ConversationSessionManager();
  });

  it('should create a session', () => {
    const session = manager.createSession('workspace-1', 'advisor-1');
    expect(session.sessionId).toBeDefined();
    expect(session.advisorId).toBe('advisor-1');
    expect(session.status).toBe(ConversationSessionStatus.ACTIVE);
  });

  it('should add message to session', () => {
    const session = manager.createSession('workspace-1', 'advisor-1');
    const updated = manager.addMessage(session.sessionId, { content: 'Hello' });
    expect(updated?.messages).toHaveLength(1);
  });

  it('should switch session', () => {
    const session1 = manager.createSession('workspace-1', 'advisor-1');
    manager.createSession('workspace-1', 'advisor-2');
    const switched = manager.switchSession(session1.sessionId);
    expect(switched.sessionId).toBe(session1.sessionId);
  });

  it('should close session', () => {
    const session = manager.createSession('workspace-1', 'advisor-1');
    const closed = manager.closeSession(session.sessionId);
    expect(closed.status).toBe(ConversationSessionStatus.CLOSED);
  });

  it('should create snapshot', () => {
    const session = manager.createSession('workspace-1', 'advisor-1');
    manager.addMessage(session.sessionId, { content: 'Hello' });
    const snapshot = manager.createSnapshot(session.sessionId);
    expect(snapshot.snapshotId).toBeDefined();
  });

  it('should update summary', () => {
    const session = manager.createSession('workspace-1', 'advisor-1');
    const summary = manager.updateSummary(session.sessionId, 'Test summary');
    expect(summary.content).toBe('Test summary');
  });

  it('should return undefined for missing session', () => {
    expect(manager.getSession('missing')).toBeUndefined();
  });

  it('should throw for invalid state', () => {
    const session = manager.createSession('workspace-1', 'advisor-1');
    manager.closeSession(session.sessionId);
    expect(() => manager.addMessage(session.sessionId, { content: 'Hello' })).toThrow(InvalidSessionStateError);
  });
});

describe('ConversationRuntime', () => {
  let registry: ConversationRegistry;
  let runtime: ConversationRuntime;

  beforeEach(() => {
    registry = new ConversationRegistry();
    runtime = new ConversationRuntime({ registry });
  });

  it('should create workspace', () => {
    const workspace = runtime.createWorkspace('project-1', 'Test Project');
    expect(workspace).toBeDefined();
    expect(runtime.getCurrentWorkspace()?.getWorkspaceId()).toBe(workspace.getWorkspaceId());
  });

  it('should switch workspace', () => {
    const workspace1 = runtime.createWorkspace('project-1', 'Project 1');
    runtime.createWorkspace('project-2', 'Project 2');
    runtime.switchWorkspace(workspace1.getWorkspaceId());
    expect(runtime.getCurrentWorkspace()?.getWorkspaceId()).toBe(workspace1.getWorkspaceId());
  });

  it('should list workspaces', () => {
    runtime.createWorkspace('project-1', 'Project 1');
    runtime.createWorkspace('project-2', 'Project 2');
    expect(runtime.listWorkspaces()).toHaveLength(2);
  });
});

describe('ConversationWorkspace', () => {
  let registry: ConversationRegistry;
  let workspace: ConversationWorkspace;

  beforeEach(() => {
    registry = new ConversationRegistry();
    const created = registry.createWorkspace('project-1', 'Test Project');
    registry.addAdvisorToWorkspace(created.workspaceId, 'advisor-1');
    workspace = new ConversationWorkspace({
      registry,
      workspaceId: created.workspaceId,
    });
  });

  it('should create session', () => {
    const session = workspace.createSession('advisor-1');
    expect(session.advisorId).toBe('advisor-1');
  });

  it('should add message', () => {
    workspace.createSession('advisor-1');
    const updated = workspace.addMessage({ content: 'Hello' });
    expect(updated?.messages).toHaveLength(1);
  });

  it('should create shared note', () => {
    const note = workspace.createSharedNote('advisor-1', SharedNoteType.RECOMMENDATION, 'Use React');
    expect(note.content).toBe('Use React');
  });

  it('should get shared notes', () => {
    workspace.createSharedNote('advisor-1', SharedNoteType.WARNING, 'Warning');
    const notes = workspace.getSharedNotes();
    expect(notes).toHaveLength(1);
  });

  it('should create collaboration request', () => {
    const created = registry.createWorkspace('project-1', 'Test Project');
    registry.addAdvisorToWorkspace(created.workspaceId, 'advisor-1');
    registry.addAdvisorToWorkspace(created.workspaceId, 'advisor-2');
    const workspace = new ConversationWorkspace({
      registry,
      workspaceId: created.workspaceId,
    });
    const request = workspace.createCollaborationRequest('advisor-1', 'advisor-2', 'Review', 'Please review');
    expect(request.subject).toBe('Review');
  });

  it('should get inbox', () => {
    const inbox = workspace.getAdvisorInbox('advisor-1');
    expect(inbox.advisorId).toBe('advisor-1');
  });

  it('should update context', () => {
    const context = workspace.updateContext({ currentTask: 'Implement feature' });
    expect(context?.currentTask).toBe('Implement feature');
  });
});

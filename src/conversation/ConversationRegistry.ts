import type { IEventBus } from '../events/IEventBus.js';
import type { AdvisorSession } from './AdvisorSession.js';
import type { ConversationContext } from './ConversationContext.js';
import type { SharedNote } from './SharedNotes.js';
import type { CollaborationRequest } from './CollaborationRequest.js';
import type { AdvisorInbox } from './AdvisorInbox.js';
import type { SessionLifecyclePayload, AdvisorStateChangedPayload, WorkspaceCreatedPayload, WorkspaceClosedPayload, SharedNoteCreatedPayload, ReviewEventPayload, ConversationTransferPayload } from './ConversationEvents.js';
import { ConversationEvents } from './ConversationEvents.js';
import { ConversationSessionStatus } from './ConversationState.js';
import { SharedNoteType } from './ConversationState.js';
import { CollaborationRequestStatus } from './ConversationState.js';
import { createAdvisorSession } from './AdvisorSession.js';
import { createConversationContext } from './ConversationContext.js';
import { createSharedNote } from './SharedNotes.js';
import { createCollaborationRequest } from './CollaborationRequest.js';
import { createAdvisorInbox } from './AdvisorInbox.js';
import { WorkspaceNotFoundError, AdvisorNotFoundInWorkspaceError, SharedNoteNotFoundError } from './ConversationError.js';

/**
 * A conversation workspace associated with a project.
 */
export interface ConversationWorkspace {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly name: string;
  readonly advisors: readonly string[];
  readonly context: ConversationContext;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/**
 * Creates a frozen ConversationWorkspace instance.
 */
export function createConversationWorkspace(workspace: ConversationWorkspace): ConversationWorkspace {
  return Object.freeze({
    ...workspace,
    advisors: Object.freeze([...workspace.advisors]),
  });
}

/**
 * Configuration for ConversationRegistry.
 */
export interface ConversationRegistryConfig {
  readonly eventBus?: IEventBus;
}

/**
 * Registry for managing conversation workspaces and sessions.
 */
export class ConversationRegistry {
  private readonly eventBus?: IEventBus;
  private readonly workspaces: Map<string, ConversationWorkspace>;
  private readonly sessions: Map<string, AdvisorSession>;
  private readonly contexts: Map<string, ConversationContext>;
  private readonly notes: Map<string, SharedNote>;
  private readonly requests: Map<string, CollaborationRequest>;
  private readonly inboxes: Map<string, AdvisorInbox>;
  private workspaceCounter = 0;
  private noteCounter = 0;

  constructor(config: ConversationRegistryConfig = {}) {
    this.eventBus = config.eventBus;
    this.workspaces = new Map();
    this.sessions = new Map();
    this.contexts = new Map();
    this.notes = new Map();
    this.requests = new Map();
    this.inboxes = new Map();
  }

  /**
   * Creates a new workspace for a project.
   */
  createWorkspace(projectId: string, name: string, initialContext?: Partial<ConversationContext>): ConversationWorkspace {
    const workspaceId = `workspace-${projectId}-${++this.workspaceCounter}`;
    const now = Date.now();

    const context = createConversationContext({
      contextId: `context-${workspaceId}`,
      workspaceId,
      projectName: name,
      architectureNotes: Object.freeze([]),
      importantFiles: Object.freeze([]),
      openDecisions: Object.freeze([]),
      codingRules: Object.freeze([]),
      createdAt: now,
      updatedAt: now,
      ...initialContext,
    });

    const workspace = createConversationWorkspace({
      workspaceId,
      projectId,
      name,
      advisors: Object.freeze([]),
      context,
      createdAt: now,
      updatedAt: now,
    });

    this.workspaces.set(workspaceId, workspace);
    this.contexts.set(workspaceId, context);

    this.publishEvent(ConversationEvents.WORKSPACE_CREATED, {
      workspaceId,
      projectId,
      timestamp: now,
    } as WorkspaceCreatedPayload);

    return workspace;
  }

  /**
   * Closes a workspace.
   */
  closeWorkspace(workspaceId: string): ConversationWorkspace {
    const workspace = this.getWorkspaceOrThrow(workspaceId);

    const closed = createConversationWorkspace({
      ...workspace,
      updatedAt: Date.now(),
    });

    this.workspaces.set(workspaceId, closed);

    this.publishEvent(ConversationEvents.WORKSPACE_CLOSED, {
      workspaceId,
      timestamp: Date.now(),
    } as WorkspaceClosedPayload);

    return closed;
  }

  /**
   * Adds an advisor to a workspace.
   */
  addAdvisorToWorkspace(workspaceId: string, advisorId: string): ConversationWorkspace {
    const workspace = this.getWorkspaceOrThrow(workspaceId);

    if (workspace.advisors.includes(advisorId)) {
      return workspace;
    }

    const updated = createConversationWorkspace({
      ...workspace,
      advisors: Object.freeze([...workspace.advisors, advisorId]),
      updatedAt: Date.now(),
    });

    this.workspaces.set(workspaceId, updated);

    this.publishEvent(ConversationEvents.ADVISOR_ACTIVATED, {
      workspaceId,
      advisorId,
      timestamp: Date.now(),
    } as AdvisorStateChangedPayload);

    return updated;
  }

  /**
   * Suspends an advisor in a workspace.
   */
  suspendAdvisorInWorkspace(workspaceId: string, advisorId: string): ConversationWorkspace {
    const workspace = this.getWorkspaceOrThrow(workspaceId);

    const updated = createConversationWorkspace({
      ...workspace,
      updatedAt: Date.now(),
    });

    this.workspaces.set(workspaceId, updated);

    this.publishEvent(ConversationEvents.ADVISOR_SUSPENDED, {
      workspaceId,
      advisorId,
      timestamp: Date.now(),
    } as AdvisorStateChangedPayload);

    return updated;
  }

  /**
   * Creates a session for an advisor in a workspace.
   */
  createSession(workspaceId: string, advisorId: string): AdvisorSession {
    this.ensureWorkspaceExists(workspaceId);
    this.ensureAdvisorInWorkspace(workspaceId, advisorId);

    const session = createAdvisorSession({
      sessionId: `session-${workspaceId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      workspaceId,
      advisorId,
      messages: Object.freeze([]),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: Object.freeze({}),
      status: ConversationSessionStatus.ACTIVE,
      lastActivity: Date.now(),
    });

    this.sessions.set(session.sessionId, session);

    this.ensureInboxExists(workspaceId, advisorId);

    this.publishEvent(ConversationEvents.SESSION_CREATED, {
      workspaceId,
      sessionId: session.sessionId,
      advisorId,
      timestamp: Date.now(),
    } as SessionLifecyclePayload);

    return session;
  }

  /**
   * Gets a workspace by ID.
   */
  getWorkspace(workspaceId: string): ConversationWorkspace | undefined {
    return this.workspaces.get(workspaceId);
  }

  /**
   * Lists all workspaces.
   */
  listWorkspaces(): readonly ConversationWorkspace[] {
    return Object.freeze(Array.from(this.workspaces.values()));
  }

  /**
   * Gets a session by ID.
   */
  getSession(sessionId: string): AdvisorSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Lists sessions for a workspace.
   */
  listSessions(workspaceId: string): readonly AdvisorSession[] {
    return Object.freeze(
      Array.from(this.sessions.values()).filter((s) => s.workspaceId === workspaceId),
    );
  }

  /**
   * Gets the context for a workspace.
   */
  getContext(workspaceId: string): ConversationContext | undefined {
    return this.contexts.get(workspaceId);
  }

  /**
   * Updates the context for a workspace.
   */
  updateContext(workspaceId: string, updates: Partial<ConversationContext>): ConversationContext {
    const existing = this.contexts.get(workspaceId);
    if (!existing) {
      throw new WorkspaceNotFoundError(workspaceId);
    }

    const updated = createConversationContext({
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    });

    this.contexts.set(workspaceId, updated);
    return updated;
  }

  /**
   * Creates a shared note.
   */
  createSharedNote(workspaceId: string, advisorId: string, noteType: SharedNoteType, content: string): SharedNote {
    this.ensureWorkspaceExists(workspaceId);
    this.ensureAdvisorInWorkspace(workspaceId, advisorId);

    const noteId = `note-${workspaceId}-${Date.now()}-${++this.noteCounter}`;
    const note = createSharedNote({
      noteId,
      workspaceId,
      advisorId,
      noteType,
      content,
      metadata: Object.freeze({}),
      createdAt: Date.now(),
    });

    this.notes.set(noteId, note);

    this.publishEvent(ConversationEvents.SHARED_NOTE_CREATED, {
      workspaceId,
      noteId,
      advisorId,
      noteType,
      timestamp: Date.now(),
    } as SharedNoteCreatedPayload);

    return note;
  }

  /**
   * Gets shared notes for a workspace.
   */
  getSharedNotes(workspaceId: string): readonly SharedNote[] {
    return Object.freeze(
      Array.from(this.notes.values()).filter((n) => n.workspaceId === workspaceId),
    );
  }

  /**
   * Creates a collaboration request.
   */
  createCollaborationRequest(
    workspaceId: string,
    requesterId: string,
    reviewerId: string,
    subject: string,
    description: string,
  ): CollaborationRequest {
    this.ensureWorkspaceExists(workspaceId);
    this.ensureAdvisorInWorkspace(workspaceId, requesterId);
    this.ensureAdvisorInWorkspace(workspaceId, reviewerId);

    const requestId = `request-${workspaceId}-${Date.now()}`;
    const request = createCollaborationRequest({
      requestId,
      workspaceId,
      requesterId,
      reviewerId,
      subject,
      description,
      status: CollaborationRequestStatus.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    this.requests.set(requestId, request);

    this.publishEvent(ConversationEvents.REVIEW_REQUESTED, {
      workspaceId,
      reviewId: requestId,
      requesterId,
      reviewerId,
      timestamp: Date.now(),
    } as ReviewEventPayload);

    return request;
  }

  /**
   * Completes a collaboration request.
   */
  completeCollaborationRequest(requestId: string, resolution: string, feedback?: string): CollaborationRequest {
    const existing = this.requests.get(requestId);
    if (!existing) {
      throw new SharedNoteNotFoundError(requestId);
    }

    const completed = createCollaborationRequest({
      ...existing,
      status: CollaborationRequestStatus.COMPLETED,
      resolution: resolution as 'approved' | 'rejected' | 'changes_requested',
      feedback,
      updatedAt: Date.now(),
    });

    this.requests.set(requestId, completed);

    this.publishEvent(ConversationEvents.REVIEW_COMPLETED, {
      workspaceId: existing.workspaceId,
      reviewId: requestId,
      requesterId: existing.requesterId,
      reviewerId: existing.reviewerId,
      timestamp: Date.now(),
    } as ReviewEventPayload);

    return completed;
  }

  /**
   * Gets an advisor's inbox.
   */
  getAdvisorInbox(workspaceId: string, advisorId: string): AdvisorInbox {
    this.ensureWorkspaceExists(workspaceId);
    this.ensureAdvisorInWorkspace(workspaceId, advisorId);

    const key = `${workspaceId}-${advisorId}`;
    const existing = this.inboxes.get(key);

    if (existing) {
      return existing;
    }

    const inbox = createAdvisorInbox({
      advisorId,
      workspaceId,
      incomingReviews: Object.freeze([]),
      architectureRequests: Object.freeze([]),
      questions: Object.freeze([]),
      sharedNotes: Object.freeze([]),
      pendingTasks: Object.freeze([]),
      updatedAt: Date.now(),
    });

    this.inboxes.set(key, inbox);
    return inbox;
  }

  /**
   * Exports a workspace.
   */
  exportWorkspace(workspaceId: string): unknown {
    const workspace = this.getWorkspaceOrThrow(workspaceId);
    const sessions = this.listSessions(workspaceId);
    const context = this.getContext(workspaceId);
    const notes = this.getSharedNotes(workspaceId);

    return Object.freeze({
      workspace,
      sessions: Object.freeze([...sessions]),
      context,
      notes: Object.freeze([...notes]),
      exportedAt: Date.now(),
    });
  }

  /**
   * Imports a workspace.
   */
  importWorkspace(data: unknown): ConversationWorkspace {
    const workspaceData = data as { workspace: ConversationWorkspace };
    const workspace = workspaceData.workspace;

    this.workspaces.set(workspace.workspaceId, workspace);

    this.publishEvent(ConversationEvents.CONVERSATION_IMPORTED, {
      workspaceId: workspace.workspaceId,
      timestamp: Date.now(),
    } as ConversationTransferPayload);

    return workspace;
  }

  private getWorkspaceOrThrow(workspaceId: string): ConversationWorkspace {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new WorkspaceNotFoundError(workspaceId);
    }
    return workspace;
  }

  private ensureWorkspaceExists(workspaceId: string): void {
    if (!this.workspaces.has(workspaceId)) {
      throw new WorkspaceNotFoundError(workspaceId);
    }
  }

  private ensureAdvisorInWorkspace(workspaceId: string, advisorId: string): void {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace || !workspace.advisors.includes(advisorId)) {
      throw new AdvisorNotFoundInWorkspaceError(advisorId, workspaceId);
    }
  }

  private ensureInboxExists(workspaceId: string, advisorId: string): void {
    const key = `${workspaceId}-${advisorId}`;
    if (!this.inboxes.has(key)) {
      const inbox = createAdvisorInbox({
        advisorId,
        workspaceId,
        incomingReviews: Object.freeze([]),
        architectureRequests: Object.freeze([]),
        questions: Object.freeze([]),
        sharedNotes: Object.freeze([]),
        pendingTasks: Object.freeze([]),
        updatedAt: Date.now(),
      });
      this.inboxes.set(key, inbox);
    }
  }

  private publishEvent(type: string, payload: unknown): void {
    if (this.eventBus) {
      this.eventBus.publish({
        type,
        timestamp: Date.now(),
        payload,
      });
    }
  }
}

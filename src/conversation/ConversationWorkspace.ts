import type { IEventBus } from '../events/IEventBus.js';
import type { AdvisorSession } from './AdvisorSession.js';
import type { SharedNote } from './SharedNotes.js';
import type { CollaborationRequest } from './CollaborationRequest.js';
import type { AdvisorInbox } from './AdvisorInbox.js';
import type { ConversationSnapshot } from './ConversationSnapshot.js';
import type { ConversationSummary } from './ConversationSummary.js';
import type { ConversationRegistry } from './ConversationRegistry.js';
import type { SessionSwitchedPayload, SummaryUpdatedPayload } from './ConversationEvents.js';
import { ConversationEvents } from './ConversationEvents.js';
import { SharedNoteType } from './ConversationState.js';
import { ConversationSessionManager } from './ConversationSessionManager.js';
import type { MemoryBundle, MemoryRecord, MemoryNote, ProjectContext } from '../memory/types.js';

/**
 * Configuration for ConversationWorkspace.
 */
export interface ConversationWorkspaceConfig {
  readonly registry: ConversationRegistry;
  readonly eventBus?: IEventBus;
  readonly workspaceId: string;
  readonly memory?: MemoryBundle;
}

/**
 * A conversation workspace providing isolated collaboration context.
 */
export class ConversationWorkspace {
  private readonly registry: ConversationRegistry;
  private readonly eventBus?: IEventBus;
  private readonly workspaceId: string;
  private readonly sessionManager: ConversationSessionManager;
  private memory: MemoryBundle | undefined;
  private currentSessionId: string | undefined;

  constructor(config: ConversationWorkspaceConfig) {
    this.registry = config.registry;
    this.eventBus = config.eventBus;
    this.workspaceId = config.workspaceId;
    this.sessionManager = new ConversationSessionManager({ eventBus: config.eventBus });
    this.memory = config.memory;
  }

  /**
   * Gets the workspace metadata.
   */
  getWorkspace(): { readonly workspaceId: string; readonly projectId: string; readonly name: string; readonly advisors: readonly string[]; readonly context: import('./ConversationContext.js').ConversationContext; readonly createdAt: number; readonly updatedAt: number; } | undefined {
    return this.registry.getWorkspace(this.workspaceId);
  }

  /**
   * Gets the current session.
   */
  getCurrentSession(): AdvisorSession | undefined {
    return this.sessionManager.getCurrentSession();
  }

  /**
   * Creates a new advisor session.
   */
  createSession(advisorId: string): AdvisorSession {
    const session = this.sessionManager.createSession(this.workspaceId, advisorId);
    this.currentSessionId = session.sessionId;
    return session;
  }

  /**
   * Switches to an existing session.
   */
  switchSession(sessionId: string): AdvisorSession {
    const session = this.sessionManager.switchSession(sessionId);
    this.currentSessionId = sessionId;

    this.publishEvent(ConversationEvents.SESSION_SWITCHED, {
      workspaceId: this.workspaceId,
      previousSessionId: this.currentSessionId,
      currentSessionId: sessionId,
      advisorId: session.advisorId,
      timestamp: Date.now(),
    } as SessionSwitchedPayload);

    return session;
  }

  /**
   * Adds a message to the current session.
   */
  addMessage(message: unknown): AdvisorSession | undefined {
    const session = this.getCurrentSession();
    if (!session) {
      return undefined;
    }
    return this.sessionManager.addMessage(session.sessionId, message);
  }

  /**
   * Gets the shared context.
   */
  getContext(): import('./ConversationContext.js').ConversationContext | undefined {
    return this.registry.getContext(this.workspaceId);
  }

  /**
   * Updates the shared context.
   */
  updateContext(updates: Partial<import('./ConversationContext.js').ConversationContext>): import('./ConversationContext.js').ConversationContext | undefined {
    return this.registry.updateContext(this.workspaceId, updates);
  }

  /**
   * Creates a shared note.
   */
  createSharedNote(advisorId: string, noteType: string, content: string): SharedNote {
    return this.registry.createSharedNote(this.workspaceId, advisorId, noteType as SharedNoteType, content);
  }

  /**
   * Gets shared notes.
   */
  getSharedNotes(): readonly SharedNote[] {
    return this.registry.getSharedNotes(this.workspaceId);
  }

  /**
   * Creates a collaboration request.
   */
  createCollaborationRequest(
    requesterId: string,
    reviewerId: string,
    subject: string,
    description: string,
  ): CollaborationRequest {
    return this.registry.createCollaborationRequest(this.workspaceId, requesterId, reviewerId, subject, description);
  }

  /**
   * Gets an advisor's inbox.
   */
  getAdvisorInbox(advisorId: string): AdvisorInbox {
    return this.registry.getAdvisorInbox(this.workspaceId, advisorId);
  }

  /**
   * Creates a snapshot.
   */
  createSnapshot(sessionId: string): ConversationSnapshot {
    return this.sessionManager.createSnapshot(sessionId);
  }

  /**
   * Updates summary.
   */
  updateSummary(sessionId: string, content: string): ConversationSummary {
    const summary = this.sessionManager.updateSummary(sessionId, content);

    this.publishEvent(ConversationEvents.SUMMARY_UPDATED, {
      workspaceId: this.workspaceId,
      sessionId,
      timestamp: Date.now(),
    } as SummaryUpdatedPayload);

    return summary;
  }

  /**
   * Gets sessions.
   */
  listSessions(): readonly AdvisorSession[] {
    return Object.freeze(
      this.sessionManager.listSessions().filter((s) => s.workspaceId === this.workspaceId),
    );
  }

  /**
   * Gets snapshots.
   */
  getSnapshots(sessionId: string): readonly ConversationSnapshot[] {
    return this.sessionManager.getSnapshots(sessionId);
  }

  /**
   * Exports the workspace.
   */
  exportWorkspace(): unknown {
    return this.registry.exportWorkspace(this.workspaceId);
  }

  /**
   * Restores a previously persisted session into this workspace.
   * Used during hydration on startup; does not regenerate the session id.
   */
  restoreSession(session: AdvisorSession): AdvisorSession {
    return this.sessionManager.restoreSession(session);
  }

  /**
   * Attaches a memory bundle to this workspace (idempotent).
   */
  setMemoryBundle(memory: MemoryBundle): void {
    this.memory = memory;
  }

  /**
   * Returns the attached memory bundle, if any.
   */
  getMemory(): MemoryBundle | undefined {
    return this.memory;
  }

  /**
   * Stores a short-term memory entry for the current session.
   */
  remember(key: string, value: unknown): MemoryRecord {
    const mem = this.requireMemory();
    const sessionId = this.getCurrentSession()?.sessionId ?? 'global';
    return mem.shortTerm.set(sessionId, key, value);
  }

  /**
   * Recalls a short-term memory entry for the current session.
   */
  recall(key: string): MemoryRecord | undefined {
    const mem = this.requireMemory();
    const sessionId = this.getCurrentSession()?.sessionId ?? 'global';
    return mem.shortTerm.get(sessionId, key);
  }

  /**
   * Forgets a short-term memory entry for the current session.
   */
  forget(key: string): boolean {
    const mem = this.requireMemory();
    const sessionId = this.getCurrentSession()?.sessionId ?? 'global';
    return mem.shortTerm.delete(sessionId, key);
  }

  /**
   * Lists all short-term memory entries for the current session.
   */
  listMemory(): readonly MemoryRecord[] {
    const mem = this.requireMemory();
    const sessionId = this.getCurrentSession()?.sessionId ?? 'global';
    return mem.shortTerm.list(sessionId);
  }

  /**
   * Adds a project-level note (persistent across sessions).
   */
  async addProjectNote(content: string, category = 'general'): Promise<MemoryNote> {
    const mem = this.requireMemory();
    if (!mem.projectContext) {
      throw new Error('No project context store configured for this workspace');
    }
    const projectId = this.getWorkspace()?.projectId ?? 'default';
    return mem.projectContext.addNote(projectId, category, content);
  }

  /**
   * Loads the project-level context (persistent across sessions).
   */
  async getProjectContext(): Promise<ProjectContext | undefined> {
    const mem = this.requireMemory();
    if (!mem.projectContext) {
      return undefined;
    }
    const projectId = this.getWorkspace()?.projectId ?? 'default';
    return mem.projectContext.loadContext(projectId);
  }

  /**
   * Gets the workspace ID.
   */
  getWorkspaceId(): string {
    return this.workspaceId;
  }

  private requireMemory(): MemoryBundle {
    if (!this.memory) {
      throw new Error('No memory bundle attached to this workspace');
    }
    return this.memory;
  }

  private publishEvent<T>(type: string, payload: T): void {
    if (this.eventBus) {
      this.eventBus.publish({
        type,
        timestamp: Date.now(),
        payload,
      });
    }
  }
}

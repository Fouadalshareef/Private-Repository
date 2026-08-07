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

/**
 * Configuration for ConversationWorkspace.
 */
export interface ConversationWorkspaceConfig {
  readonly registry: ConversationRegistry;
  readonly eventBus?: IEventBus;
  readonly workspaceId: string;
}

/**
 * A conversation workspace providing isolated collaboration context.
 */
export class ConversationWorkspace {
  private readonly registry: ConversationRegistry;
  private readonly eventBus?: IEventBus;
  private readonly workspaceId: string;
  private readonly sessionManager: ConversationSessionManager;
  private currentSessionId: string | undefined;

  constructor(config: ConversationWorkspaceConfig) {
    this.registry = config.registry;
    this.eventBus = config.eventBus;
    this.workspaceId = config.workspaceId;
    this.sessionManager = new ConversationSessionManager({ eventBus: config.eventBus });
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
   * Gets the workspace ID.
   */
  getWorkspaceId(): string {
    return this.workspaceId;
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

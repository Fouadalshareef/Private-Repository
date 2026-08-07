import type { IEventBus } from '../events/IEventBus.js';
import type { ConversationRegistry } from './ConversationRegistry.js';
import type { ConversationContext } from './ConversationContext.js';
import type { AdvisorSession } from './AdvisorSession.js';
import type { IConversationStore } from '../storage/IConversationStore.js';
import type { SessionListEntry, PruneOptions, PruneResult } from '../storage/types/StorageTypes.js';
import { ConversationWorkspace } from './ConversationWorkspace.js';

/**
 * Configuration for ConversationRuntime.
 */
export interface ConversationRuntimeConfig {
  readonly registry: ConversationRegistry;
  readonly eventBus?: IEventBus;
  readonly store?: IConversationStore;
}

/**
 * The Conversation Runtime manages all conversation state for Cupaw.
 *
 * It is the single entry point for:
 * - Workspace management
 * - Advisor session lifecycle
 * - Shared context
 * - Shared notes
 * - Collaboration requests
 * - Snapshots and summaries
 *
 * No other module should manage conversation state directly.
 */
export class ConversationRuntime {
  private readonly registry: ConversationRegistry;
  private readonly eventBus?: IEventBus;
  private readonly store?: IConversationStore;
  private readonly workspaces: Map<string, ConversationWorkspace>;
  private currentWorkspaceId: string | undefined;

  constructor(config: ConversationRuntimeConfig) {
    this.registry = config.registry;
    this.eventBus = config.eventBus;
    this.store = config.store;
    this.workspaces = new Map();
  }

  /**
   * Creates a new workspace for a project.
   */
  createWorkspace(projectId: string, name: string, initialContext?: Partial<ConversationContext>): ConversationWorkspace {
    const workspace = this.registry.createWorkspace(projectId, name, initialContext);
    const conversationWorkspace = new ConversationWorkspace({
      registry: this.registry,
      eventBus: this.eventBus,
      workspaceId: workspace.workspaceId,
    });

    this.workspaces.set(workspace.workspaceId, conversationWorkspace);
    this.currentWorkspaceId = workspace.workspaceId;

    return conversationWorkspace;
  }

  /**
   * Gets the current workspace.
   */
  getCurrentWorkspace(): ConversationWorkspace | undefined {
    if (!this.currentWorkspaceId) {
      return undefined;
    }
    return this.workspaces.get(this.currentWorkspaceId);
  }

  /**
   * Switches to a workspace.
   */
  switchWorkspace(workspaceId: string): ConversationWorkspace | undefined {
    const workspace = this.workspaces.get(workspaceId);
    if (workspace) {
      this.currentWorkspaceId = workspaceId;
    }
    return workspace;
  }

  /**
   * Lists all workspaces.
   */
  listWorkspaces(): readonly ConversationWorkspace[] {
    return Object.freeze(Array.from(this.workspaces.values()));
  }

  /**
   * Gets a workspace by ID.
   */
  getWorkspace(workspaceId: string): ConversationWorkspace | undefined {
    return this.workspaces.get(workspaceId);
  }

  /**
   * Gets the registry.
   */
  getRegistry(): ConversationRegistry {
    return this.registry;
  }

  /**
   * Returns the configured persistence store, if any.
   */
  getStore(): IConversationStore | undefined {
    return this.store;
  }

  /**
   * Hydrates a workspace from the persistence store on startup.
   * Restores all stored sessions for the workspace and activates the most recent.
   * @returns The number of sessions restored.
   */
  public async hydrateWorkspace(workspaceId: string): Promise<number> {
    if (!this.store) {
      return 0;
    }
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      return 0;
    }

    const entries = await this.store.listSessions(workspaceId);
    let latest: AdvisorSession | undefined;

    for (const entry of entries) {
      const session = await this.store.loadSession(entry.sessionId);
      workspace.restoreSession(session);
      if (!latest || session.updatedAt > latest.updatedAt) {
        latest = session;
      }
    }

    if (latest) {
      workspace.switchSession(latest.sessionId);
    }

    return entries.length;
  }

  /**
   * Persists a single session to the store.
   */
  public async persistSession(session: AdvisorSession): Promise<void> {
    if (!this.store) {
      return;
    }
    await this.store.saveSession(session);
  }

  /**
   * Persists the currently active session of the current workspace.
   */
  public async persistCurrentSession(): Promise<void> {
    const workspace = this.getCurrentWorkspace();
    const session = workspace?.getCurrentSession();
    if (session) {
      await this.persistSession(session);
    }
  }

  /**
   * Persists all sessions of a workspace.
   * @returns The number of sessions persisted.
   */
  public async persistWorkspace(workspaceId: string): Promise<number> {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace || !this.store) {
      return 0;
    }
    const sessions = workspace.listSessions();
    for (const session of sessions) {
      await this.store.saveSession(session);
    }
    return sessions.length;
  }

  /**
   * Deletes a stored session by id.
   */
  public async deleteStoredSession(sessionId: string): Promise<boolean> {
    if (!this.store) {
      return false;
    }
    return this.store.deleteSession(sessionId);
  }

  /**
   * Lists stored sessions, optionally filtered by workspace.
   */
  public async listStoredSessions(workspaceId?: string): Promise<readonly SessionListEntry[]> {
    if (!this.store) {
      return Object.freeze([]);
    }
    return this.store.listSessions(workspaceId);
  }

  /**
   * Prunes stored sessions by age and/or count.
   */
  public async pruneStoredSessions(options?: PruneOptions): Promise<PruneResult> {
    if (!this.store) {
      return Object.freeze({ purged: Object.freeze([]), remaining: 0 });
    }
    return this.store.pruneSessions(options);
  }
}

import type { IEventBus } from '../events/IEventBus.js';
import type { ConversationRegistry } from './ConversationRegistry.js';
import type { ConversationContext } from './ConversationContext.js';
import { ConversationWorkspace } from './ConversationWorkspace.js';

/**
 * Configuration for ConversationRuntime.
 */
export interface ConversationRuntimeConfig {
  readonly registry: ConversationRegistry;
  readonly eventBus?: IEventBus;
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
  private readonly workspaces: Map<string, ConversationWorkspace>;
  private currentWorkspaceId: string | undefined;

  constructor(config: ConversationRuntimeConfig) {
    this.registry = config.registry;
    this.eventBus = config.eventBus;
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
}

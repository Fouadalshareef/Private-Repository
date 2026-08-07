import { ConversationRuntime, ConversationWorkspace } from '../../conversation/index.js';
import type { MemoryBundle, MemoryNote } from '../../memory/types.js';

/**
 * Frozen output for the /active command.
 */
export interface ActiveAdvisorOutput {
  readonly active: boolean;
  readonly advisorId: string | undefined;
  readonly workspaceId: string | undefined;
  readonly sessionId: string | undefined;
}

/**
 * Frozen output for the /session command.
 */
export interface SessionInfoOutput {
  readonly sessionId: string;
  readonly advisorId: string;
  readonly workspaceId: string;
  readonly messageCount: number;
  readonly status: string;
}

/**
 * Frozen output for the /sessions command.
 */
export interface SessionsListOutput {
  readonly sessions: readonly SessionInfoOutput[];
}

/**
 * Frozen output for the /collaboration command.
 */
export interface CollaborationOutput {
  readonly pendingReviews: number;
  readonly pendingQuestions: number;
  readonly sharedNotes: number;
}

/**
 * Frozen output for the /resume command.
 */
export interface ResumeOutput {
  readonly project: string;
  readonly advisor: string | undefined;
  readonly currentGoal: string | undefined;
  readonly lastDecision: string | undefined;
  readonly pendingTasks: number;
  readonly summary: string | undefined;
}

/**
 * Frozen output for the /remember command.
 */
export interface RememberOutput {
  readonly key: string;
  readonly value: unknown;
  readonly storedAt: number;
}

/**
 * Frozen output for the /recall command.
 */
export interface RecallOutput {
  readonly key: string;
  readonly found: boolean;
  readonly value: unknown;
}

/**
 * Frozen output for the /notes command.
 */
export interface NotesOutput {
  readonly notes: readonly MemoryNote[];
}

/**
 * CLI controller output union type.
 */
export type CLIControllerOutput =
  | { readonly kind: 'active'; readonly value: ActiveAdvisorOutput }
  | { readonly kind: 'session'; readonly value: SessionInfoOutput }
  | { readonly kind: 'sessions'; readonly value: SessionsListOutput }
  | { readonly kind: 'collaboration'; readonly value: CollaborationOutput }
  | { readonly kind: 'resume'; readonly value: ResumeOutput }
  | { readonly kind: 'remember'; readonly value: RememberOutput }
  | { readonly kind: 'recall'; readonly value: RecallOutput }
  | { readonly kind: 'notes'; readonly value: NotesOutput };

/**
 * Integrates the ConversationRuntime into the CLI layer.
 *
 * Responsible for:
 * - Managing a default workspace
 * - Routing /active, /session, /sessions, /collaboration, /resume commands
 * - Keeping advisor/session state synchronized with the runtime
 */
export class AdvisorCLIController {
  private readonly runtime: ConversationRuntime;
  private workspace: ConversationWorkspace;
  private readonly memory: MemoryBundle | undefined;
  private currentSessionId: string | undefined;

  constructor(runtime: ConversationRuntime, memory?: MemoryBundle) {
    this.runtime = runtime;
    this.memory = memory;
    let workspace = runtime.getCurrentWorkspace();
    if (!workspace) {
      workspace = runtime.createWorkspace('cli-default', 'CLI Default Workspace');
    }
    this.workspace = workspace;
    if (memory) {
      workspace.setMemoryBundle(memory);
    }
    this.currentSessionId = undefined;
  }

  /**
   * Handles a controller-specific slash command.
   */
  public handleCommand(input: string): CLIControllerOutput | { readonly kind: 'unknown'; readonly command: string } {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) {
      return Object.freeze({ kind: 'unknown', command: trimmed });
    }

    const parts = trimmed.split(' ');
    const command = parts[0].toLowerCase();

    switch (command) {
      case '/active': {
        const value = this.getActiveAdvisor();
        return Object.freeze({ kind: 'active', value });
      }
      case '/session': {
        const value = this.getSessionInfo();
        return Object.freeze({ kind: 'session', value });
      }
      case '/sessions': {
        const value = this.listSessions();
        return Object.freeze({ kind: 'sessions', value });
      }
      case '/collaboration': {
        const value = this.getCollaborationStatus();
        return Object.freeze({ kind: 'collaboration', value });
      }
      case '/resume': {
        const value = this.getResumeInfo();
        return Object.freeze({ kind: 'resume', value });
      }
      case '/remember': {
        const body = trimmed.slice('/remember'.length).trim();
        const spaceIdx = body.indexOf(' ');
        if (spaceIdx <= 0) {
          return Object.freeze({ kind: 'unknown', command: trimmed });
        }
        const key = body.slice(0, spaceIdx).trim();
        const value = body.slice(spaceIdx + 1).trim();
        const record = this.workspace.remember(key, value);
        return Object.freeze({
          kind: 'remember',
          value: Object.freeze({ key: record.key, value: record.value, storedAt: record.updatedAt }),
        });
      }
      case '/recall': {
        const key = trimmed.slice('/recall'.length).trim();
        const record = key.length > 0 ? this.workspace.recall(key) : undefined;
        return Object.freeze({
          kind: 'recall',
          value: Object.freeze({
            key,
            found: record !== undefined,
            value: record?.value,
          }),
        });
      }
      default:
        return Object.freeze({ kind: 'unknown', command });
    }
  }

  /**
   * Switches the active advisor in the conversation workspace.
   * If the advisor already has a session, switches to it; otherwise creates a new one.
   * Persists the resulting session to the runtime store when available.
   */
  public switchAdvisor(advisorId: string): void {
    const sessions = this.workspace.listSessions();
    const existing = sessions.find((s) => s.advisorId === advisorId);

    if (existing) {
      this.workspace.switchSession(existing.sessionId);
      this.currentSessionId = existing.sessionId;
    } else {
      const session = this.workspace.createSession(advisorId);
      this.currentSessionId = session.sessionId;
    }

    void this.runtime.persistCurrentSession().catch(() => undefined);
  }

  /**
   * Deterministically persists the current session to the runtime store.
   * Used to guarantee durability after interactions.
   */
  public async persist(): Promise<void> {
    await this.runtime.persistCurrentSession();
  }

  /**
   * Gets the currently active advisor information.
   */
  public getActiveAdvisor(): ActiveAdvisorOutput {
    const currentSession = this.workspace.getCurrentSession();
    const workspace = this.workspace.getWorkspace();

    return Object.freeze({
      active: currentSession !== undefined,
      advisorId: currentSession?.advisorId,
      workspaceId: workspace?.workspaceId,
      sessionId: currentSession?.sessionId,
    });
  }

  /**
   * Gets information about the active session.
   */
  public getSessionInfo(): SessionInfoOutput {
    const currentSession = this.workspace.getCurrentSession();
    const workspace = this.workspace.getWorkspace();

    if (!currentSession) {
      return Object.freeze({
        sessionId: 'none',
        advisorId: 'none',
        workspaceId: workspace?.workspaceId ?? 'none',
        messageCount: 0,
        status: 'inactive',
      });
    }

    return Object.freeze({
      sessionId: currentSession.sessionId,
      advisorId: currentSession.advisorId,
      workspaceId: currentSession.workspaceId,
      messageCount: currentSession.messages.length,
      status: currentSession.status,
    });
  }

  /**
   * Lists all sessions in the current workspace.
   */
  public listSessions(): SessionsListOutput {
    const sessions = this.workspace.listSessions();
    const sessionInfos = sessions.map((session) =>
      Object.freeze({
        sessionId: session.sessionId,
        advisorId: session.advisorId,
        workspaceId: session.workspaceId,
        messageCount: session.messages.length,
        status: session.status,
      }),
    );

    return Object.freeze({
      sessions: Object.freeze(sessionInfos),
    });
  }

  /**
   * Gets collaboration status for the current workspace.
   */
  public getCollaborationStatus(): CollaborationOutput {
    const currentSession = this.workspace.getCurrentSession();
    if (!currentSession) {
      return Object.freeze({
        pendingReviews: 0,
        pendingQuestions: 0,
        sharedNotes: 0,
      });
    }

    const notes = this.workspace.getSharedNotes();
    const inbox = this.workspace.getAdvisorInbox(currentSession.advisorId);

    return Object.freeze({
      pendingReviews: inbox.incomingReviews.length,
      pendingQuestions: inbox.questions.length,
      sharedNotes: notes.length,
    });
  }

  /**
   * Gets resume information for the current workspace.
   */
  public getResumeInfo(): ResumeOutput {
    const workspace = this.workspace.getWorkspace();
    const currentSession = this.workspace.getCurrentSession();
    const context = this.workspace.getContext();

    return Object.freeze({
      project: workspace?.name ?? 'Unknown',
      advisor: currentSession?.advisorId,
      currentGoal: context?.currentTask,
      lastDecision: context?.openDecisions[0],
      pendingTasks: context?.openDecisions.length ?? 0,
      summary: currentSession?.summary,
    });
  }

  /**
   * Gets the current workspace ID.
   */
  public getWorkspaceId(): string | undefined {
    return this.workspace.getWorkspaceId();
  }
}

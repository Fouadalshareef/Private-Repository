/**
 * Base error class for conversation-related errors.
 */
export class ConversationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversationError';
  }
}

/**
 * Error thrown when a workspace is not found.
 */
export class WorkspaceNotFoundError extends ConversationError {
  public readonly workspaceId: string;

  constructor(workspaceId: string) {
    super(`Workspace not found: ${workspaceId}`);
    this.name = 'WorkspaceNotFoundError';
    this.workspaceId = workspaceId;
  }
}

/**
 * Error thrown when a session is not found.
 */
export class SessionNotFoundError extends ConversationError {
  public readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
    this.sessionId = sessionId;
  }
}

/**
 * Error thrown when an advisor is not found in a workspace.
 */
export class AdvisorNotFoundInWorkspaceError extends ConversationError {
  public readonly advisorId: string;
  public readonly workspaceId: string;

  constructor(advisorId: string, workspaceId: string) {
    super(`Advisor not found in workspace: ${advisorId}`);
    this.name = 'AdvisorNotFoundInWorkspaceError';
    this.advisorId = advisorId;
    this.workspaceId = workspaceId;
  }
}

/**
 * Error thrown when a snapshot is not found.
 */
export class SnapshotNotFoundError extends ConversationError {
  public readonly snapshotId: string;

  constructor(snapshotId: string) {
    super(`Snapshot not found: ${snapshotId}`);
    this.name = 'SnapshotNotFoundError';
    this.snapshotId = snapshotId;
  }
}

/**
 * Error thrown when an operation is invalid for the current session state.
 */
export class InvalidSessionStateError extends ConversationError {
  public readonly currentState: string;

  constructor(currentState: string) {
    super(`Invalid session state for this operation: ${currentState}`);
    this.name = 'InvalidSessionStateError';
    this.currentState = currentState;
  }
}

/**
 * Error thrown when a shared note is not found.
 */
export class SharedNoteNotFoundError extends ConversationError {
  public readonly noteId: string;

  constructor(noteId: string) {
    super(`Shared note not found: ${noteId}`);
    this.name = 'SharedNoteNotFoundError';
    this.noteId = noteId;
  }
}

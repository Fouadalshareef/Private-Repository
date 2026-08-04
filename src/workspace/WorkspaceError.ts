/**
 * Base error thrown by the workspace system for meaningful error reporting.
 */
export class WorkspaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceError';

    // Restore prototype chain (needed when targeting older ES versions
    // and also good practice for custom errors extending built-in classes).
    Object.setPrototypeOf(this, WorkspaceError.prototype);
  }
}

/**
 * Thrown when attempting to create a workspace with invalid parameters
 * (e.g., an empty ID, name, or root path).
 */
export class WorkspaceCreationError extends WorkspaceError {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceCreationError';
    Object.setPrototypeOf(this, WorkspaceCreationError.prototype);
  }
}

/**
 * Thrown when attempting to open a workspace that is already open
 * or in an invalid state for opening.
 */
export class WorkspaceOpenError extends WorkspaceError {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceOpenError';
    Object.setPrototypeOf(this, WorkspaceOpenError.prototype);
  }
}

/**
 * Thrown when attempting to close a workspace that is not open.
 */
export class WorkspaceCloseError extends WorkspaceError {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceCloseError';
    Object.setPrototypeOf(this, WorkspaceCloseError.prototype);
  }
}

/**
 * Thrown when a workspace operation is attempted while the workspace
 * is in a state that does not allow it.
 */
export class WorkspaceStateError extends WorkspaceError {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceStateError';
    Object.setPrototypeOf(this, WorkspaceStateError.prototype);
  }
}
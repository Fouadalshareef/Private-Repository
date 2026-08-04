/**
 * Base error thrown by the project scanner.
 */
export class ProjectScannerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectScannerError';

    // Restore prototype chain (needed when targeting older ES versions
    // and also good practice for custom errors extending built-in classes).
    Object.setPrototypeOf(this, ProjectScannerError.prototype);
  }
}

/**
 * Thrown when attempting to scan a workspace that is not open.
 */
export class WorkspaceNotOpenError extends ProjectScannerError {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceNotOpenError';
    Object.setPrototypeOf(this, WorkspaceNotOpenError.prototype);
  }
}

/**
 * Thrown when the workspace root does not exist in the file system.
 */
export class ProjectRootNotFoundError extends ProjectScannerError {
  constructor(rootPath: string) {
    super(`Project root not found: "${rootPath}"`);
    this.name = 'ProjectRootNotFoundError';
    Object.setPrototypeOf(this, ProjectRootNotFoundError.prototype);
  }
}
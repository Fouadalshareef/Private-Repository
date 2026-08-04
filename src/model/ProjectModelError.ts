/**
 * Base error thrown by the Project Object Model.
 */
export class ProjectModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectModelError';

    // Restore prototype chain (needed when targeting older ES versions
    // and also good practice for custom errors extending built-in classes).
    Object.setPrototypeOf(this, ProjectModelError.prototype);
  }
}

/**
 * Thrown when a node is not found in the project tree.
 */
export class ProjectNodeNotFoundError extends ProjectModelError {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectNodeNotFoundError';
    Object.setPrototypeOf(this, ProjectNodeNotFoundError.prototype);
  }
}

/**
 * Thrown when a node with the same ID or path already exists.
 */
export class ProjectNodeAlreadyExistsError extends ProjectModelError {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectNodeAlreadyExistsError';
    Object.setPrototypeOf(this, ProjectNodeAlreadyExistsError.prototype);
  }
}
/**
 * Base error thrown by the file system abstraction layer.
 */
export class FileSystemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileSystemError';

    // Restore prototype chain (needed when targeting older ES versions
    // and also good practice for custom errors extending built-in classes).
    Object.setPrototypeOf(this, FileSystemError.prototype);
  }
}

/**
 * Thrown when a file or directory does not exist.
 */
export class FileNotFoundError extends FileSystemError {
  constructor(path: string) {
    super(`File or directory not found: "${path}"`);
    this.name = 'FileNotFoundError';
    Object.setPrototypeOf(this, FileNotFoundError.prototype);
  }
}

/**
 * Thrown when a file or directory already exists.
 */
export class FileAlreadyExistsError extends FileSystemError {
  constructor(path: string) {
    super(`File or directory already exists: "${path}"`);
    this.name = 'FileAlreadyExistsError';
    Object.setPrototypeOf(this, FileAlreadyExistsError.prototype);
  }
}

/**
 * Thrown when an operation is invalid (e.g., moving a file into itself,
 * or operating on a path that is a directory when a file is expected).
 */
export class FileSystemOperationError extends FileSystemError {
  constructor(message: string) {
    super(message);
    this.name = 'FileSystemOperationError';
    Object.setPrototypeOf(this, FileSystemOperationError.prototype);
  }
}
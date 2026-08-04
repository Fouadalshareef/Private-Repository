/**
 * Base error thrown by the source index.
 */
export class SourceIndexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceIndexError';

    // Restore prototype chain (needed when targeting older ES versions
    // and also good practice for custom errors extending built-in classes).
    Object.setPrototypeOf(this, SourceIndexError.prototype);
  }
}

/**
 * Thrown when an operation is attempted before the index has been built.
 */
export class SourceIndexNotBuiltError extends SourceIndexError {
  constructor(message: string) {
    super(message);
    this.name = 'SourceIndexNotBuiltError';
    Object.setPrototypeOf(this, SourceIndexNotBuiltError.prototype);
  }
}

/**
 * Thrown when a file is not found in the index.
 */
export class SourceFileNotFoundError extends SourceIndexError {
  constructor(path: string) {
    super(`Source file not found in index: "${path}"`);
    this.name = 'SourceFileNotFoundError';
    Object.setPrototypeOf(this, SourceFileNotFoundError.prototype);
  }
}
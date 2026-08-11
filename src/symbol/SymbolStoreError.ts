/**
 * Base error class for symbol store operations.
 */
export class SymbolStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SymbolStoreError';
  }
}

/**
 * Error thrown when a symbol is not found.
 */
export class SymbolNotFoundError extends SymbolStoreError {
  constructor(public readonly symbolId: string) {
    super(`Symbol not found: ${symbolId}`);
    this.name = 'SymbolNotFoundError';
  }
}

/**
 * Error thrown when a duplicate symbol identity is detected.
 */
export class DuplicateSymbolError extends SymbolStoreError {
  constructor(public readonly symbolId: string) {
    super(`Duplicate symbol identity: ${symbolId}`);
    this.name = 'DuplicateSymbolError';
  }
}

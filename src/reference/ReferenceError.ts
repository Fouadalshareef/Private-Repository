/**
 * Base error class for reference engine operations.
 */
export class ReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReferenceError';
  }
}

/**
 * Error thrown when a referenced symbol cannot be resolved.
 */
export class UnresolvedReferenceError extends ReferenceError {
  constructor(public readonly reference: string) {
    super(`Unresolved reference: ${reference}`);
    this.name = 'UnresolvedReferenceError';
  }
}

import type { DiffEntry } from '../diff/DiffResult.js';

/**
 * Base error class for patch engine operations.
 */
export class PatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatchError';
  }
}

/**
 * Error thrown when a patch cannot be applied because the base content
 * does not match the expected content.
 */
export class PatchBaseMismatchError extends PatchError {
  constructor(public readonly expected: string, public readonly actual: string) {
    super('Patch base content does not match expected content');
    this.name = 'PatchBaseMismatchError';
  }
}

/**
 * Result of applying a patch.
 */
export interface PatchResult {
  /** Whether the patch was applied successfully. */
  readonly success: boolean;
  /** The resulting content if successful. */
  readonly content?: string;
  /** Error message if failed. */
  readonly error?: string;
  /** The diff entries that were applied. */
  readonly appliedEntries: readonly DiffEntry[];
}

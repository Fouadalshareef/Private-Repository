/**
 * Represents a single entry in a structured diff.
 */
export interface DiffEntry {
  /** The type of change. */
  readonly type: 'added' | 'removed' | 'modified' | 'unchanged';
  /** The old line number, if applicable. */
  readonly oldLine?: number;
  /** The new line number, if applicable. */
  readonly newLine?: number;
  /** The old content, if applicable. */
  readonly oldContent?: string;
  /** The new content, if applicable. */
  readonly newContent?: string;
}

/**
 * Result of a diff computation.
 */
export interface DiffResult {
  /** Whether the two contents are identical. */
  readonly isIdentical: boolean;
  /** The diff entries. */
  readonly entries: readonly DiffEntry[];
  /** The number of added lines. */
  readonly addedLines: number;
  /** The number of removed lines. */
  readonly removedLines: number;
  /** The number of modified lines. */
  readonly modifiedLines: number;
}

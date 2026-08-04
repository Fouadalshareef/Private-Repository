import type { SourceIndexEntry } from './SourceIndexEntry.js';

/**
 * The result of building a source index.
 */
export interface SourceIndexResult {
  /** The number of files indexed. */
  readonly indexedFiles: number;

  /** The timestamp when the index was built. */
  readonly builtAt: number;

  /** A map of file path to index entry. */
  readonly entries: ReadonlyMap<string, SourceIndexEntry>;
}
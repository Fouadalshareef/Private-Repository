/**
 * An entry in the source index representing a single source file.
 *
 * This entry is a placeholder index record — it describes the file
 * without parsing its contents.
 */
export interface SourceIndexEntry {
  /** The path of the source file relative to the project root. */
  readonly path: string;

  /** The name of the source file. */
  readonly name: string;

  /** The extension of the source file (including leading dot). */
  readonly extension: string;

  /** The size of the file in bytes. */
  readonly size: number;

  /** Whether the file has been parsed (always `false` until parsing is implemented). */
  readonly parsed: boolean;
}
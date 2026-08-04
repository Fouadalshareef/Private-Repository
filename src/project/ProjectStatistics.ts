/**
 * Describes aggregate statistics of a scanned project.
 */
export interface ProjectStatistics {
  /** The total number of files discovered. */
  readonly totalFiles: number;

  /** The total number of directories discovered (excluding the root). */
  readonly totalDirectories: number;

  /** The total size of all files in bytes. */
  readonly totalSize: number;

  /** A map of file extension (including leading dot) to file count. */
  readonly extensions: ReadonlyMap<string, number>;
}
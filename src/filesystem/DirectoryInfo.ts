/**
 * Describes the metadata of a directory in the file system.
 */
export interface DirectoryInfo {
  /** The name of the directory. */
  readonly name: string;

  /** The full path of the directory. */
  readonly path: string;

  /** The size of the directory in bytes (sum of all contained entries). */
  readonly size: number;

  /** The timestamp when the directory was created. */
  readonly createdAt: number;

  /** The timestamp when the directory was last modified. */
  readonly modifiedAt: number;

  /** Always `true` for directories. */
  readonly isDirectory: true;
}
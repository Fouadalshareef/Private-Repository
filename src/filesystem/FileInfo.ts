/**
 * Describes the metadata of a file in the file system.
 */
export interface FileInfo {
  /** The name of the file. */
  readonly name: string;

  /** The full path of the file. */
  readonly path: string;

  /** The size of the file in bytes. */
  readonly size: number;

  /** The timestamp when the file was created. */
  readonly createdAt: number;

  /** The timestamp when the file was last modified. */
  readonly modifiedAt: number;

  /** Always `false` for files. */
  readonly isDirectory: false;
}
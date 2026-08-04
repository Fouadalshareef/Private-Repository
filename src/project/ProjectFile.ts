/**
 * Describes a file discovered during a project scan.
 */
export interface ProjectFile {
  /** The path of the file relative to the project root. */
  readonly path: string;

  /** The name of the file. */
  readonly name: string;

  /** The extension of the file, including the leading dot (e.g., `.ts`). */
  readonly extension: string;

  /** The size of the file in bytes. */
  readonly size: number;

  /** The timestamp when the file was created. */
  readonly createdAt: number;

  /** The timestamp when the file was last modified. */
  readonly modifiedAt: number;
}
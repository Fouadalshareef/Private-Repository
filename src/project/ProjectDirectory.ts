/**
 * Describes a directory discovered during a project scan.
 */
export interface ProjectDirectory {
  /** The path of the directory relative to the project root. */
  readonly path: string;

  /** The name of the directory. */
  readonly name: string;

  /** The depth of the directory relative to the project root (root is depth 0). */
  readonly depth: number;
}
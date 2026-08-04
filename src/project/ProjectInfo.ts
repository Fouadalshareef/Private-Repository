/**
 * Describes the metadata of a scanned project.
 */
export interface ProjectInfo {
  /** The unique identifier of the project. */
  readonly projectId: string;

  /** The display name of the project. */
  readonly projectName: string;

  /** The root path of the project. */
  readonly rootPath: string;

  /** The timestamp when the project was first created. */
  readonly createdAt: number;

  /** The timestamp when the project was last scanned. */
  readonly scannedAt: number;
}
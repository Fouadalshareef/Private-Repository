/**
 * Describes the metadata of a workspace.
 */
export interface WorkspaceInfo {
  /** The unique identifier of the workspace. */
  readonly id: string;

  /** The display name of the workspace. */
  readonly name: string;

  /** The root path of the workspace. */
  readonly rootPath: string;

  /** The timestamp when the workspace was created. */
  readonly createdAt: number;

  /** The timestamp when the workspace was last opened, or `undefined` if never opened. */
  readonly openedAt: number | undefined;

  /** The version of the workspace. */
  readonly version: string;
}
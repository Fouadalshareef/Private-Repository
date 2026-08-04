/**
 * Optional configuration for a workspace.
 *
 * All options are optional and default to sensible values when omitted.
 */
export interface WorkspaceOptions {
  /**
   * If `true`, the workspace is read-only and cannot be modified.
   * Defaults to `false`.
   */
  readOnly?: boolean;

  /**
   * If `true`, the workspace is automatically opened upon creation.
   * Defaults to `false`.
   */
  autoCreate?: boolean;

  /**
   * If `true`, file system watchers will be enabled once watcher
   * support is implemented.
   *
   * @deprecated Reserved for future use — no watchers are implemented yet.
   */
  watchChanges?: boolean;
}
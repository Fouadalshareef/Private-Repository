/**
 * Optional configuration for a file system instance.
 */
export interface FileSystemOptions {
  /**
   * If `true`, the file system is read-only and cannot be modified.
   * Defaults to `false`.
   */
  readOnly?: boolean;

  /**
   * If `true`, file system watchers will be enabled once watcher
   * support is implemented.
   *
   * @deprecated Reserved for future use — no watchers are implemented yet.
   */
  watchChanges?: boolean;
}
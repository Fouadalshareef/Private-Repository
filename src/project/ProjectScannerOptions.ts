/**
 * Options to control how a project scan is performed.
 */
export interface ProjectScannerOptions {
  /**
   * If `true`, hidden files and directories (those starting with a dot)
   * are included in the scan. Defaults to `false`.
   */
  includeHidden?: boolean;

  /**
   * If `true`, the scan is performed recursively through subdirectories.
   * Defaults to `true`.
   */
  recursive?: boolean;

  /**
   * The maximum depth to scan relative to the workspace root.
   * `undefined` means unlimited depth. The root is depth 0.
   */
  maxDepth?: number;

  /**
   * File extensions to exclude from the scan (including the leading dot,
   * e.g., `.log`).
   */
  ignoredExtensions?: readonly string[];

  /**
   * Directory names to exclude from the scan (e.g., `node_modules`).
   */
  ignoredDirectories?: readonly string[];
}
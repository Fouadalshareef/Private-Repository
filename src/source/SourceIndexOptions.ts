/**
 * Options to control how a source index is built.
 */
export interface SourceIndexOptions {
  /**
   * If `true`, files without an extension are included in the index.
   * Defaults to `true`.
   */
  includeExtensionless?: boolean;

  /**
   * If `true`, the index tracks symbol placeholders for each file.
   * Defaults to `false` — symbols are always empty until parsing is
   * implemented in a future task.
   *
   * @deprecated Reserved for future use — no parsing is performed yet.
   */
  trackSymbols?: boolean;
}
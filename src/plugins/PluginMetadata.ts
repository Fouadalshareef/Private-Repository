/**
 * Describes the metadata of a plugin.
 */
export interface PluginMetadata {
  /** The unique identifier of the plugin. */
  readonly id: string;

  /** The human-readable display name of the plugin. */
  readonly name: string;

  /** The semantic version of the plugin. */
  readonly version: string;

  /** The author of the plugin. */
  readonly author: string;

  /** A short description of what the plugin does. */
  readonly description: string;
}
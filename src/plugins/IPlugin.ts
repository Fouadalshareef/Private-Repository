import type { PluginContext } from './PluginContext.js';

/**
 * Contract that every plugin must implement.
 *
 * A plugin exposes its metadata along with an initialize and dispose
 * lifecycle. No real plugins are implemented by the core — this is the
 * infrastructure contract that future modules (AI Providers, Workspace,
 * Memory, Tools, etc.) will satisfy.
 */
export interface IPlugin {
  /** The unique identifier of the plugin. */
  readonly id: string;

  /** The human-readable display name of the plugin. */
  readonly name: string;

  /** The semantic version of the plugin. */
  readonly version: string;

  /** A short description of what the plugin does. */
  readonly description: string;

  /**
   * Initializes the plugin with access to the application context.
   * This is a synchronous initialization — no async operations.
   *
   * @param context The strongly typed plugin context.
   */
  initialize(context: PluginContext): void;

  /**
   * Disposes the plugin, releasing any resources it holds.
   */
  dispose(): void;
}
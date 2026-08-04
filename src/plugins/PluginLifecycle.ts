/**
 * Defines the lifecycle states of a plugin.
 *
 * - `registered`: The plugin has been registered with the manager.
 * - `initialized`: The plugin's `initialize()` method has been called
 *   successfully. Reserved for future use when a distinction between
 *   "initialized" and "running" is needed.
 * - `running`: The plugin is initialized and operational.
 * - `stopped`: The plugin has been stopped. Reserved for future use
 *   when a `stop()` lifecycle method is introduced.
 * - `disposed`: The plugin's `dispose()` method has been called.
 */
export enum PluginLifecycle {
  REGISTERED = 'registered',
  INITIALIZED = 'initialized',
  RUNNING = 'running',
  STOPPED = 'stopped',
  DISPOSED = 'disposed',
}
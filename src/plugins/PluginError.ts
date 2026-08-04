/**
 * Custom error thrown by the plugin system for meaningful error reporting.
 */
export class PluginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginError';

    // Restore prototype chain (needed when targeting older ES versions
    // and also good practice for custom errors extending built-in classes).
    Object.setPrototypeOf(this, PluginError.prototype);
  }
}
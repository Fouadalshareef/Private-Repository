import type { IPlugin } from './IPlugin.js';
import { PluginLifecycle } from './PluginLifecycle.js';
import { PluginError } from './PluginError.js';

/**
 * Internal entry stored in the registry, pairing a plugin with its
 * current lifecycle state.
 */
interface PluginEntry {
  /** The registered plugin. */
  readonly plugin: IPlugin;

  /** The current lifecycle state of the plugin. */
  lifecycle: PluginLifecycle;
}

/**
 * Maintains all registered plugins.
 *
 * The registry is the storage layer of the plugin system. It prevents
 * duplicate plugin IDs and throws meaningful {@link PluginError}
 * objects when an operation is invalid.
 *
 * The registry itself does not invoke plugin lifecycle methods — it
 * only tracks lifecycle state. The {@link PluginManager} orchestrates
 * lifecycle transitions.
 */
export class PluginRegistry {
  private entries: Map<string, PluginEntry>;

  constructor() {
    this.entries = new Map<string, PluginEntry>();
  }

  /**
   * Registers a plugin. Throws if a plugin with the same ID is already
   * registered.
   *
   * @param plugin The plugin to register.
   * @throws {PluginError} If a plugin with the same ID already exists.
   */
  public register(plugin: IPlugin): void {
    if (this.entries.has(plugin.id)) {
      throw new PluginError(`A plugin with id "${plugin.id}" is already registered.`);
    }
    this.entries.set(plugin.id, { plugin, lifecycle: PluginLifecycle.REGISTERED });
  }

  /**
   * Unregisters a plugin by its ID. Throws if the plugin is not
   * registered, or if it has not been disposed yet.
   *
   * @param id The ID of the plugin to unregister.
   * @throws {PluginError} If the plugin is not registered or not disposed.
   */
  public unregister(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new PluginError(`No plugin registered with id "${id}".`);
    }
    if (entry.lifecycle !== PluginLifecycle.DISPOSED) {
      throw new PluginError(
        `Plugin "${id}" must be disposed before it can be unregistered.`,
      );
    }
    this.entries.delete(id);
  }

  /**
   * Returns the plugin registered with the given ID, or `undefined`
   * if no such plugin exists.
   *
   * @param id The ID of the plugin.
   * @returns The plugin, or `undefined`.
   */
  public get(id: string): IPlugin | undefined {
    return this.entries.get(id)?.plugin;
  }

  /**
   * Returns all registered plugins.
   *
   * @returns An array of all registered plugins.
   */
  public getAll(): IPlugin[] {
    return Array.from(this.entries.values()).map((entry) => entry.plugin);
  }

  /**
   * Returns whether a plugin with the given ID is registered.
   *
   * @param id The ID of the plugin.
   * @returns `true` if registered, `false` otherwise.
   */
  public has(id: string): boolean {
    return this.entries.has(id);
  }

  /**
   * Returns the current lifecycle state of a plugin, or `undefined`
   * if no such plugin exists.
   *
   * @param id The ID of the plugin.
   * @returns The lifecycle state, or `undefined`.
   */
  public getLifecycle(id: string): PluginLifecycle | undefined {
    return this.entries.get(id)?.lifecycle;
  }

  /**
   * Updates the lifecycle state of a plugin.
   *
   * @param id The ID of the plugin.
   * @param lifecycle The new lifecycle state.
   * @throws {PluginError} If no plugin is registered with the given ID.
   */
  public setLifecycle(id: string, lifecycle: PluginLifecycle): void {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new PluginError(`No plugin registered with id "${id}".`);
    }
    entry.lifecycle = lifecycle;
  }

  /**
   * Removes all registered plugins from the registry.
   */
  public clear(): void {
    this.entries.clear();
  }
}
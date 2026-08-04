import type { IPlugin } from './IPlugin.js';
import type { PluginContext } from './PluginContext.js';
import { PluginRegistry } from './PluginRegistry.js';
import { PluginLifecycle } from './PluginLifecycle.js';
import { PluginError } from './PluginError.js';

/**
 * Orchestrates the plugin lifecycle and delegates storage to a
 * {@link PluginRegistry}.
 *
 * The manager is the public entry point of the plugin system. It
 * supports registering, unregistering, initializing, disposing, and
 * querying plugins. All operations are synchronous and in-memory.
 */
export class PluginManager {
  private readonly registry: PluginRegistry;

  /**
   * Creates a new plugin manager.
   * @param registry Optional registry to use. A fresh registry is
   * created when none is provided.
   */
  constructor(registry?: PluginRegistry) {
    this.registry = registry ?? new PluginRegistry();
  }

  /**
   * Registers a plugin. Throws if a plugin with the same ID is already
   * registered.
   *
   * @param plugin The plugin to register.
   * @throws {PluginError} If a plugin with the same ID already exists.
   */
  public register(plugin: IPlugin): void {
    this.registry.register(plugin);
  }

  /**
   * Unregisters a plugin by its ID. The plugin must be disposed first.
   *
   * @param id The ID of the plugin to unregister.
   * @throws {PluginError} If the plugin is not registered or not disposed.
   */
  public unregister(id: string): void {
    this.registry.unregister(id);
  }

  /**
   * Initializes a plugin, transitioning it through the
   * `initialized` and `running` lifecycle states.
   *
   * @param id The ID of the plugin to initialize.
   * @param context The plugin context to pass to the plugin.
   * @throws {PluginError} If the plugin is not registered, or if it is
   * not in the `registered` state.
   */
  public initialize(id: string, context: PluginContext): void {
    const lifecycle = this.registry.getLifecycle(id);
    if (lifecycle === undefined) {
      throw new PluginError(`No plugin registered with id "${id}".`);
    }
    if (lifecycle !== PluginLifecycle.REGISTERED) {
      throw new PluginError(
        `Plugin "${id}" cannot be initialized from state "${lifecycle}".`,
      );
    }

    const plugin = this.registry.get(id);
    if (!plugin) {
      throw new PluginError(`No plugin registered with id "${id}".`);
    }

    this.registry.setLifecycle(id, PluginLifecycle.INITIALIZED);
    plugin.initialize(context);
    this.registry.setLifecycle(id, PluginLifecycle.RUNNING);
  }

  /**
   * Disposes a plugin, transitioning it to the `disposed` state.
   *
   * @param id The ID of the plugin to dispose.
   * @throws {PluginError} If the plugin is not registered, or if it is
   * already disposed.
   */
  public dispose(id: string): void {
    const lifecycle = this.registry.getLifecycle(id);
    if (lifecycle === undefined) {
      throw new PluginError(`No plugin registered with id "${id}".`);
    }
    if (lifecycle === PluginLifecycle.DISPOSED) {
      throw new PluginError(`Plugin "${id}" is already disposed.`);
    }

    const plugin = this.registry.get(id);
    if (!plugin) {
      throw new PluginError(`No plugin registered with id "${id}".`);
    }

    plugin.dispose();
    this.registry.setLifecycle(id, PluginLifecycle.DISPOSED);
  }

  /**
   * Returns the plugin registered with the given ID, or `undefined`
   * if no such plugin exists.
   *
   * @param id The ID of the plugin.
   * @returns The plugin, or `undefined`.
   */
  public get(id: string): IPlugin | undefined {
    return this.registry.get(id);
  }

  /**
   * Returns all registered plugins.
   *
   * @returns An array of all registered plugins.
   */
  public getAll(): IPlugin[] {
    return this.registry.getAll();
  }

  /**
   * Returns whether a plugin with the given ID is registered.
   *
   * @param id The ID of the plugin.
   * @returns `true` if registered, `false` otherwise.
   */
  public has(id: string): boolean {
    return this.registry.has(id);
  }

  /**
   * Returns the current lifecycle state of a plugin, or `undefined`
   * if no such plugin exists.
   *
   * @param id The ID of the plugin.
   * @returns The lifecycle state, or `undefined`.
   */
  public getLifecycle(id: string): PluginLifecycle | undefined {
    return this.registry.getLifecycle(id);
  }
}
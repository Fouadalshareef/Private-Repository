import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginManager } from '../src/plugins/PluginManager.js';
import { PluginRegistry } from '../src/plugins/PluginRegistry.js';
import { PluginError } from '../src/plugins/PluginError.js';
import { PluginLifecycle } from '../src/plugins/PluginLifecycle.js';
import type { IPlugin } from '../src/plugins/IPlugin.js';
import type { PluginContext } from '../src/plugins/PluginContext.js';
import { Container } from '../src/core/container/Container.js';
import { Logger } from '../src/logging/Logger.js';
import { DefaultConfiguration } from '../src/config/DefaultConfiguration.js';
import { EventBus } from '../src/events/EventBus.js';

/**
 * Creates a minimal plugin context for tests.
 */
function createTestContext(): PluginContext {
  return {
    container: new Container(),
    logger: new Logger(),
    configuration: new DefaultConfiguration(),
    eventBus: new EventBus(),
  };
}

/**
 * Creates a test plugin with optional spies.
 */
function createTestPlugin(
  id: string,
  overrides?: Partial<IPlugin>,
): IPlugin & { initializeSpy: ReturnType<typeof vi.fn>; disposeSpy: ReturnType<typeof vi.fn> } {
  const initializeSpy = vi.fn();
  const disposeSpy = vi.fn();

  const plugin: IPlugin = {
    id,
    name: `Test Plugin ${id}`,
    version: '1.0.0',
    description: `Test plugin for ${id}`,
    initialize: initializeSpy,
    dispose: disposeSpy,
    ...overrides,
  };

  return { ...plugin, initializeSpy, disposeSpy };
}

describe('PluginManager', () => {
  let manager: PluginManager;
  let context: PluginContext;

  beforeEach(() => {
    manager = new PluginManager();
    context = createTestContext();
  });

  // ── plugin registration ──────────────────────────────────────

  it('should register a plugin', () => {
    const plugin = createTestPlugin('plugin-a');
    manager.register(plugin);

    expect(manager.has('plugin-a')).toBe(true);
    expect(manager.get('plugin-a')).toBe(plugin);
  });

  it('should register multiple plugins', () => {
    const pluginA = createTestPlugin('plugin-a');
    const pluginB = createTestPlugin('plugin-b');

    manager.register(pluginA);
    manager.register(pluginB);

    expect(manager.getAll()).toHaveLength(2);
    expect(manager.has('plugin-a')).toBe(true);
    expect(manager.has('plugin-b')).toBe(true);
  });

  it('should set lifecycle to REGISTERED on registration', () => {
    const plugin = createTestPlugin('plugin-a');
    manager.register(plugin);

    expect(manager.getLifecycle('plugin-a')).toBe(PluginLifecycle.REGISTERED);
  });

  // ── duplicate IDs ────────────────────────────────────────────

  it('should throw PluginError when registering a duplicate ID', () => {
    const pluginA = createTestPlugin('plugin-a');
    const pluginB = createTestPlugin('plugin-a');

    manager.register(pluginA);
    expect(() => manager.register(pluginB)).toThrow(PluginError);
  });

  it('should throw a meaningful error message for duplicate IDs', () => {
    const pluginA = createTestPlugin('duplicate-plugin');
    const pluginB = createTestPlugin('duplicate-plugin');

    manager.register(pluginA);
    try {
      manager.register(pluginB);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PluginError);
      expect((error as Error).message).toContain('duplicate-plugin');
    }
  });

  it('should have the correct error name for duplicate IDs', () => {
    const pluginA = createTestPlugin('plugin-a');
    const pluginB = createTestPlugin('plugin-a');

    manager.register(pluginA);
    try {
      manager.register(pluginB);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PluginError);
      expect((error as Error).name).toBe('PluginError');
    }
  });

  // ── plugin lookup ────────────────────────────────────────────

  it('should return undefined for an unregistered plugin', () => {
    expect(manager.get('non-existent')).toBeUndefined();
  });

  it('should return false for an unregistered plugin', () => {
    expect(manager.has('non-existent')).toBe(false);
  });

  it('should return all registered plugins', () => {
    const pluginA = createTestPlugin('plugin-a');
    const pluginB = createTestPlugin('plugin-b');

    manager.register(pluginA);
    manager.register(pluginB);

    const all = manager.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(pluginA);
    expect(all).toContain(pluginB);
  });

  it('should return an empty array when no plugins are registered', () => {
    expect(manager.getAll()).toEqual([]);
  });

  // ── plugin initialization ────────────────────────────────────

  it('should initialize a registered plugin', () => {
    const plugin = createTestPlugin('plugin-a');
    manager.register(plugin);

    manager.initialize('plugin-a', context);

    expect(plugin.initializeSpy).toHaveBeenCalledTimes(1);
    expect(plugin.initializeSpy).toHaveBeenCalledWith(context);
  });

  it('should set lifecycle to RUNNING after initialization', () => {
    const plugin = createTestPlugin('plugin-a');
    manager.register(plugin);

    manager.initialize('plugin-a', context);

    expect(manager.getLifecycle('plugin-a')).toBe(PluginLifecycle.RUNNING);
  });

  it('should throw PluginError when initializing an unregistered plugin', () => {
    expect(() => manager.initialize('non-existent', context)).toThrow(PluginError);
  });

  it('should throw PluginError when initializing an already-initialized plugin', () => {
    const plugin = createTestPlugin('plugin-a');
    manager.register(plugin);
    manager.initialize('plugin-a', context);

    expect(() => manager.initialize('plugin-a', context)).toThrow(PluginError);
  });

  it('should throw PluginError when initializing a disposed plugin', () => {
    const plugin = createTestPlugin('plugin-a');
    manager.register(plugin);
    manager.initialize('plugin-a', context);
    manager.dispose('plugin-a');

    expect(() => manager.initialize('plugin-a', context)).toThrow(PluginError);
  });

  it('should throw a meaningful error when initializing an unregistered plugin', () => {
    try {
      manager.initialize('missing-plugin', context);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PluginError);
      expect((error as Error).message).toContain('missing-plugin');
    }
  });

  // ── plugin disposal ──────────────────────────────────────────

  it('should dispose a registered plugin', () => {
    const plugin = createTestPlugin('plugin-a');
    manager.register(plugin);
    manager.initialize('plugin-a', context);

    manager.dispose('plugin-a');

    expect(plugin.disposeSpy).toHaveBeenCalledTimes(1);
  });

  it('should set lifecycle to DISPOSED after disposal', () => {
    const plugin = createTestPlugin('plugin-a');
    manager.register(plugin);
    manager.initialize('plugin-a', context);

    manager.dispose('plugin-a');

    expect(manager.getLifecycle('plugin-a')).toBe(PluginLifecycle.DISPOSED);
  });

  it('should throw PluginError when disposing an unregistered plugin', () => {
    expect(() => manager.dispose('non-existent')).toThrow(PluginError);
  });

  it('should throw PluginError when disposing an already-disposed plugin', () => {
    const plugin = createTestPlugin('plugin-a');
    manager.register(plugin);
    manager.initialize('plugin-a', context);
    manager.dispose('plugin-a');

    expect(() => manager.dispose('plugin-a')).toThrow(PluginError);
  });

  it('should throw a meaningful error when disposing an unregistered plugin', () => {
    try {
      manager.dispose('missing-plugin');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PluginError);
      expect((error as Error).message).toContain('missing-plugin');
    }
  });

  // ── unregister ───────────────────────────────────────────────

  it('should unregister a disposed plugin', () => {
    const plugin = createTestPlugin('plugin-a');
    manager.register(plugin);
    manager.initialize('plugin-a', context);
    manager.dispose('plugin-a');

    manager.unregister('plugin-a');

    expect(manager.has('plugin-a')).toBe(false);
  });

  it('should throw PluginError when unregistering a non-disposed plugin', () => {
    const plugin = createTestPlugin('plugin-a');
    manager.register(plugin);

    expect(() => manager.unregister('plugin-a')).toThrow(PluginError);
  });

  it('should throw PluginError when unregistering an unregistered plugin', () => {
    expect(() => manager.unregister('non-existent')).toThrow(PluginError);
  });

  // ── registry behavior ────────────────────────────────────────

  it('should use a provided registry instance', () => {
    const registry = new PluginRegistry();
    const customManager = new PluginManager(registry);
    const plugin = createTestPlugin('plugin-a');

    customManager.register(plugin);

    expect(registry.has('plugin-a')).toBe(true);
  });

  it('should create a fresh registry when none is provided', () => {
    const managerA = new PluginManager();
    const managerB = new PluginManager();
    const plugin = createTestPlugin('plugin-a');

    managerA.register(plugin);

    expect(managerB.has('plugin-a')).toBe(false);
  });

  it('should not share state between two managers', () => {
    const managerA = new PluginManager();
    const managerB = new PluginManager();
    const pluginA = createTestPlugin('plugin-a');
    const pluginB = createTestPlugin('plugin-b');

    managerA.register(pluginA);
    managerB.register(pluginB);

    expect(managerA.has('plugin-a')).toBe(true);
    expect(managerA.has('plugin-b')).toBe(false);
    expect(managerB.has('plugin-a')).toBe(false);
    expect(managerB.has('plugin-b')).toBe(true);
  });

  // ── lifecycle changes ────────────────────────────────────────

  it('should transition through lifecycle states correctly', () => {
    const plugin = createTestPlugin('plugin-a');
    manager.register(plugin);

    expect(manager.getLifecycle('plugin-a')).toBe(PluginLifecycle.REGISTERED);

    manager.initialize('plugin-a', context);
    expect(manager.getLifecycle('plugin-a')).toBe(PluginLifecycle.RUNNING);

    manager.dispose('plugin-a');
    expect(manager.getLifecycle('plugin-a')).toBe(PluginLifecycle.DISPOSED);
  });

  it('should return undefined lifecycle for an unregistered plugin', () => {
    expect(manager.getLifecycle('non-existent')).toBeUndefined();
  });

  it('should allow re-registering after unregister', () => {
    const pluginA = createTestPlugin('plugin-a');
    manager.register(pluginA);
    manager.initialize('plugin-a', context);
    manager.dispose('plugin-a');
    manager.unregister('plugin-a');

    const pluginB = createTestPlugin('plugin-a');
    manager.register(pluginB);

    expect(manager.has('plugin-a')).toBe(true);
    expect(manager.get('plugin-a')).toBe(pluginB);
  });
});
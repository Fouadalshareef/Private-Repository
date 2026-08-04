import { describe, it, expect, vi } from 'vitest';
import { PluginRegistry } from '../src/plugins/PluginRegistry.js';
import { PluginError } from '../src/plugins/PluginError.js';
import { PluginLifecycle } from '../src/plugins/PluginLifecycle.js';
import type { IPlugin } from '../src/plugins/IPlugin.js';

/**
 * Creates a test plugin.
 */
function createTestPlugin(id: string): IPlugin {
  return {
    id,
    name: `Test Plugin ${id}`,
    version: '1.0.0',
    description: `Test plugin for ${id}`,
    initialize: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('PluginRegistry', () => {
  // ── register ─────────────────────────────────────────────────

  it('should register a plugin', () => {
    const registry = new PluginRegistry();
    const plugin = createTestPlugin('plugin-a');

    registry.register(plugin);

    expect(registry.has('plugin-a')).toBe(true);
    expect(registry.get('plugin-a')).toBe(plugin);
  });

  it('should set lifecycle to REGISTERED on registration', () => {
    const registry = new PluginRegistry();
    const plugin = createTestPlugin('plugin-a');

    registry.register(plugin);

    expect(registry.getLifecycle('plugin-a')).toBe(PluginLifecycle.REGISTERED);
  });

  it('should throw PluginError when registering a duplicate ID', () => {
    const registry = new PluginRegistry();
    const pluginA = createTestPlugin('plugin-a');
    const pluginB = createTestPlugin('plugin-a');

    registry.register(pluginA);
    expect(() => registry.register(pluginB)).toThrow(PluginError);
  });

  it('should throw a meaningful error message for duplicate IDs', () => {
    const registry = new PluginRegistry();
    const pluginA = createTestPlugin('duplicate-plugin');
    const pluginB = createTestPlugin('duplicate-plugin');

    registry.register(pluginA);
    try {
      registry.register(pluginB);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PluginError);
      expect((error as Error).message).toContain('duplicate-plugin');
    }
  });

  // ── get / getAll / has ───────────────────────────────────────

  it('should return undefined for an unregistered plugin', () => {
    const registry = new PluginRegistry();
    expect(registry.get('non-existent')).toBeUndefined();
  });

  it('should return false for an unregistered plugin', () => {
    const registry = new PluginRegistry();
    expect(registry.has('non-existent')).toBe(false);
  });

  it('should return all registered plugins', () => {
    const registry = new PluginRegistry();
    const pluginA = createTestPlugin('plugin-a');
    const pluginB = createTestPlugin('plugin-b');

    registry.register(pluginA);
    registry.register(pluginB);

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(pluginA);
    expect(all).toContain(pluginB);
  });

  it('should return an empty array when no plugins are registered', () => {
    const registry = new PluginRegistry();
    expect(registry.getAll()).toEqual([]);
  });

  // ── lifecycle tracking ───────────────────────────────────────

  it('should return undefined lifecycle for an unregistered plugin', () => {
    const registry = new PluginRegistry();
    expect(registry.getLifecycle('non-existent')).toBeUndefined();
  });

  it('should update lifecycle state', () => {
    const registry = new PluginRegistry();
    const plugin = createTestPlugin('plugin-a');
    registry.register(plugin);

    registry.setLifecycle('plugin-a', PluginLifecycle.RUNNING);
    expect(registry.getLifecycle('plugin-a')).toBe(PluginLifecycle.RUNNING);

    registry.setLifecycle('plugin-a', PluginLifecycle.DISPOSED);
    expect(registry.getLifecycle('plugin-a')).toBe(PluginLifecycle.DISPOSED);
  });

  it('should throw PluginError when setting lifecycle for an unregistered plugin', () => {
    const registry = new PluginRegistry();
    expect(() => registry.setLifecycle('non-existent', PluginLifecycle.RUNNING)).toThrow(
      PluginError,
    );
  });

  it('should throw a meaningful error when setting lifecycle for an unregistered plugin', () => {
    const registry = new PluginRegistry();
    try {
      registry.setLifecycle('missing-plugin', PluginLifecycle.RUNNING);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PluginError);
      expect((error as Error).message).toContain('missing-plugin');
    }
  });

  // ── unregister ───────────────────────────────────────────────

  it('should unregister a disposed plugin', () => {
    const registry = new PluginRegistry();
    const plugin = createTestPlugin('plugin-a');
    registry.register(plugin);
    registry.setLifecycle('plugin-a', PluginLifecycle.DISPOSED);

    registry.unregister('plugin-a');

    expect(registry.has('plugin-a')).toBe(false);
  });

  it('should throw PluginError when unregistering a non-disposed plugin', () => {
    const registry = new PluginRegistry();
    const plugin = createTestPlugin('plugin-a');
    registry.register(plugin);

    expect(() => registry.unregister('plugin-a')).toThrow(PluginError);
  });

  it('should throw PluginError when unregistering an unregistered plugin', () => {
    const registry = new PluginRegistry();
    expect(() => registry.unregister('non-existent')).toThrow(PluginError);
  });

  it('should throw a meaningful error when unregistering an unregistered plugin', () => {
    const registry = new PluginRegistry();
    try {
      registry.unregister('missing-plugin');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PluginError);
      expect((error as Error).message).toContain('missing-plugin');
    }
  });

  // ── clear ────────────────────────────────────────────────────

  it('should clear all registered plugins', () => {
    const registry = new PluginRegistry();
    const pluginA = createTestPlugin('plugin-a');
    const pluginB = createTestPlugin('plugin-b');

    registry.register(pluginA);
    registry.register(pluginB);
    registry.clear();

    expect(registry.has('plugin-a')).toBe(false);
    expect(registry.has('plugin-b')).toBe(false);
    expect(registry.getAll()).toEqual([]);
  });

  it('should clear without throwing when empty', () => {
    const registry = new PluginRegistry();
    expect(() => registry.clear()).not.toThrow();
  });

  // ── isolation ────────────────────────────────────────────────

  it('should not share state between two registries', () => {
    const registryA = new PluginRegistry();
    const registryB = new PluginRegistry();
    const plugin = createTestPlugin('plugin-a');

    registryA.register(plugin);

    expect(registryA.has('plugin-a')).toBe(true);
    expect(registryB.has('plugin-a')).toBe(false);
  });
});
import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from '../src/core/container/Container.js';
import { ContainerError } from '../src/core/container/ContainerError.js';

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  // ── register + resolve (transient) ──────────────────────────

  it('should register and resolve a transient service', () => {
    container.register('MyService', () => ({ value: 42 }));
    const result = container.resolve<{ value: number }>('MyService');
    expect(result).toEqual({ value: 42 });
  });

  it('should create a new instance on each transient resolve', () => {
    container.register('Counter', () => ({ count: 0 }));
    const a = container.resolve<{ count: number }>('Counter');
    const b = container.resolve<{ count: number }>('Counter');
    expect(a).not.toBe(b);
    a.count = 1;
    expect(b.count).toBe(0);
  });

  it('should call the transient factory on every resolve', () => {
    let callCount = 0;
    container.register('Factory', () => {
      callCount++;
      return { id: callCount };
    });
    container.resolve('Factory');
    container.resolve('Factory');
    container.resolve('Factory');
    expect(callCount).toBe(3);
  });

  // ── registerSingleton ───────────────────────────────────────

  it('should return the same instance for singleton services', () => {
    container.registerSingleton('Singleton', () => ({ count: 0 }));
    const a = container.resolve<{ count: number }>('Singleton');
    const b = container.resolve<{ count: number }>('Singleton');
    expect(a).toBe(b);
    a.count = 5;
    expect(b.count).toBe(5);
  });

  it('should call the singleton factory only once', () => {
    let callCount = 0;
    container.registerSingleton('Lazy', () => {
      callCount++;
      return { created: callCount };
    });
    container.resolve('Lazy');
    container.resolve('Lazy');
    container.resolve('Lazy');
    expect(callCount).toBe(1);
  });

  // ── registerInstance ────────────────────────────────────────

  it('should register and return a pre-created instance', () => {
    const instance = { name: 'pre-created' };
    container.registerInstance('Instance', instance);
    const result = container.resolve<{ name: string }>('Instance');
    expect(result).toBe(instance);
  });

  it('should return the same instance on multiple resolves for registerInstance', () => {
    const instance = { value: 'test' };
    container.registerInstance('MyInstance', instance);
    const a = container.resolve('MyInstance');
    const b = container.resolve('MyInstance');
    expect(a).toBe(b);
    expect(a).toBe(instance);
  });

  // ── has() ───────────────────────────────────────────────────

  it('should return true for registered services and false for unregistered', () => {
    container.register('Existing', () => ({}));
    expect(container.has('Existing')).toBe(true);
    expect(container.has('NonExistent')).toBe(false);
  });

  // ── remove() ────────────────────────────────────────────────

  it('should remove a registered service', () => {
    container.register('ToRemove', () => ({}));
    expect(container.has('ToRemove')).toBe(true);
    container.remove('ToRemove');
    expect(container.has('ToRemove')).toBe(false);
  });

  it('should not throw when removing a non-existent service', () => {
    expect(() => container.remove('NonExistent')).not.toThrow();
  });

  // ── clear() ─────────────────────────────────────────────────

  it('should clear all registered services', () => {
    container.register('A', () => ({}));
    container.register('B', () => ({}));
    container.registerInstance('C', {});
    container.clear();
    expect(container.has('A')).toBe(false);
    expect(container.has('B')).toBe(false);
    expect(container.has('C')).toBe(false);
  });

  // ── unknown service error ────────────────────────────────────

  it('should throw ContainerError when resolving an unknown service', () => {
    expect(() => container.resolve('Unknown')).toThrow(ContainerError);
  });

  it('should throw a meaningful error message for unknown services', () => {
    try {
      container.resolve('MyUnknownService');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ContainerError);
      expect((error as Error).message).toContain('MyUnknownService');
    }
  });

  it('should have the correct error name', () => {
    try {
      container.resolve('Unknown');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ContainerError);
      expect((error as Error).name).toBe('ContainerError');
    }
  });

  // ── override option ────────────────────────────────────────

  it('should silently replace when override is true (default)', () => {
    container.register('Service', () => ({ version: 1 }));
    container.register('Service', () => ({ version: 2 }));
    const result = container.resolve<{ version: number }>('Service');
    expect(result.version).toBe(2);
  });

  it('should throw when override is false and service already exists', () => {
    container.register('Service', () => ({}));
    expect(() =>
      container.register('Service', () => ({}), { override: false }),
    ).toThrow(ContainerError);
  });

  it('should throw a meaningful error when override is false and service exists', () => {
    container.register('MyService', () => ({}));
    try {
      container.register('MyService', () => ({}), { override: false });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ContainerError);
      expect((error as Error).message).toContain('MyService');
    }
  });

  // ── symbol identifiers ──────────────────────────────────────

  it('should support symbol identifiers', () => {
    const sym = Symbol('MyService');
    container.register(sym, () => ({ data: 'test' }));
    expect(container.has(sym)).toBe(true);
    const result = container.resolve<{ data: string }>(sym);
    expect(result.data).toBe('test');
  });

  it('should treat different symbols as different services', () => {
    const sym1 = Symbol('Service');
    const sym2 = Symbol('Service');
    container.register(sym1, () => ({ id: 1 }));
    container.register(sym2, () => ({ id: 2 }));
    expect(container.resolve<{ id: number }>(sym1).id).toBe(1);
    expect(container.resolve<{ id: number }>(sym2).id).toBe(2);
  });

  // ── multiple services coexist ────────────────────────────────

  it('should support multiple registered services of different lifetimes', () => {
    container.register('Transient', () => ({ name: 'A' }));
    container.registerSingleton('Singleton', () => ({ name: 'B' }));
    container.registerInstance('Instance', { name: 'C' });

    expect(container.resolve<{ name: string }>('Transient').name).toBe('A');
    expect(container.resolve<{ name: string }>('Singleton').name).toBe('B');
    expect(container.resolve<{ name: string }>('Instance').name).toBe('C');
  });

  // ── singleton after remove ──────────────────────────────────

  it('should re-create a singleton after remove and re-register', () => {
    container.registerSingleton('Service', () => ({ count: 0 }));
    const a = container.resolve<{ count: number }>('Service');
    a.count = 10;

    container.remove('Service');
    container.registerSingleton('Service', () => ({ count: 0 }));
    const b = container.resolve<{ count: number }>('Service');

    expect(b).not.toBe(a);
    expect(b.count).toBe(0);
  });
});
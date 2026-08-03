/**
 * Defines the lifetime of a registered service.
 * - `transient`: A new instance is created each time `resolve()` is called.
 * - `singleton`: A single instance is created on first `resolve()` and reused.
 */
export type ServiceLifetime = 'transient' | 'singleton';

/**
 * Describes a registered service in the container.
 * @template T The type of the service instance.
 */
export interface ServiceDescriptor<T = unknown> {
  /** The lifetime of the service. */
  readonly lifetime: ServiceLifetime;

  /** The factory function that creates the service instance. */
  readonly factory: () => T;

  /** The cached instance for singleton services. */
  instance: T | undefined;

  /** Whether the singleton instance has been created. */
  isInstantiated: boolean;
}
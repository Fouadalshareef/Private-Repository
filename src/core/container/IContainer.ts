import type { ServiceIdentifier } from './ServiceIdentifier.js';
import type { RegistrationOptions } from './RegistrationOptions.js';

/**
 * Contract for a Dependency Injection Container.
 *
 * The container is a central service registry that allows registering
 * and resolving services by their identifiers. Services are resolved
 * manually — there is no automatic constructor injection.
 */
export interface IContainer {
  /**
   * Registers a transient service. A new instance is created on each
   * call to `resolve()`.
   *
   * @param identifier The unique identifier for the service.
   * @param factory The factory function that creates the service instance.
   * @param options Optional registration options.
   * @template T The type of the service instance.
   */
  register<T>(
    identifier: ServiceIdentifier<T>,
    factory: () => T,
    options?: RegistrationOptions,
  ): void;

  /**
   * Registers a singleton service. The instance is created once on the
   * first call to `resolve()` and reused for all subsequent calls.
   *
   * @param identifier The unique identifier for the service.
   * @param factory The factory function that creates the service instance.
   * @param options Optional registration options.
   * @template T The type of the service instance.
   */
  registerSingleton<T>(
    identifier: ServiceIdentifier<T>,
    factory: () => T,
    options?: RegistrationOptions,
  ): void;

  /**
   * Registers an existing instance as a singleton. The provided instance
   * is returned directly on every call to `resolve()` without invoking
   * a factory.
   *
   * @param identifier The unique identifier for the service.
   * @param instance The pre-created instance to register.
   * @param options Optional registration options.
   * @template T The type of the service instance.
   */
  registerInstance<T>(
    identifier: ServiceIdentifier<T>,
    instance: T,
    options?: RegistrationOptions,
  ): void;

  /**
   * Resolves a service by its identifier.
   *
   * @param identifier The unique identifier for the service.
   * @returns The service instance.
   * @throws {ContainerError} If no service is registered with the given identifier.
   * @template T The type of the service instance.
   */
  resolve<T>(identifier: ServiceIdentifier<T>): T;

  /**
   * Checks whether a service is registered with the given identifier.
   *
   * @param identifier The unique identifier for the service.
   * @returns `true` if a service is registered, `false` otherwise.
   * @template T The type of the service instance.
   */
  has<T>(identifier: ServiceIdentifier<T>): boolean;

  /**
   * Removes a registered service by its identifier.
   * Does nothing if no service is registered with the given identifier.
   *
   * @param identifier The unique identifier for the service.
   * @template T The type of the service instance.
   */
  remove<T>(identifier: ServiceIdentifier<T>): void;

  /**
   * Clears all registered services from the container.
   */
  clear(): void;
}
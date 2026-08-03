import type { IContainer } from './IContainer.js';
import type { ServiceIdentifier } from './ServiceIdentifier.js';
import type { ServiceDescriptor, ServiceLifetime } from './ServiceDescriptor.js';
import type { RegistrationOptions } from './RegistrationOptions.js';
import { ContainerError } from './ContainerError.js';

/**
 * A lightweight, type-safe dependency injection container.
 *
 * Services are registered with factory functions and resolved manually.
 * The container supports transient and singleton lifetimes, as well as
 * pre-created instance registration.
 *
 * @remarks
 * - No external libraries are used.
 * - No decorators or reflection are used.
 * - No global singleton — create as many containers as needed.
 * - No automatic constructor injection — services are resolved manually.
 */
export class Container implements IContainer {
  private services: Map<string | symbol, ServiceDescriptor<unknown>>;

  constructor() {
    this.services = new Map<string | symbol, ServiceDescriptor<unknown>>();
  }

  public register<T>(
    identifier: ServiceIdentifier<T>,
    factory: () => T,
    options?: RegistrationOptions,
  ): void {
    this.setDescriptor(identifier, 'transient', factory, undefined, false, options);
  }

  public registerSingleton<T>(
    identifier: ServiceIdentifier<T>,
    factory: () => T,
    options?: RegistrationOptions,
  ): void {
    this.setDescriptor(identifier, 'singleton', factory, undefined, false, options);
  }

  public registerInstance<T>(
    identifier: ServiceIdentifier<T>,
    instance: T,
    options?: RegistrationOptions,
  ): void {
    this.setDescriptor(identifier, 'singleton', () => instance, instance, true, options);
  }

  public resolve<T>(identifier: ServiceIdentifier<T>): T {
    const descriptor = this.services.get(identifier);

    if (!descriptor) {
      throw new ContainerError(
        `No service registered for identifier: ${String(identifier)}`,
      );
    }

    if (descriptor.lifetime === 'singleton') {
      if (!descriptor.isInstantiated) {
        descriptor.instance = descriptor.factory();
        descriptor.isInstantiated = true;
      }
      return descriptor.instance as T;
    }

    // Transient: create a new instance on every resolve.
    return descriptor.factory() as T;
  }

  public has<T>(identifier: ServiceIdentifier<T>): boolean {
    return this.services.has(identifier);
  }

  public remove<T>(identifier: ServiceIdentifier<T>): void {
    this.services.delete(identifier);
  }

  public clear(): void {
    this.services.clear();
  }

  private setDescriptor<T>(
    identifier: ServiceIdentifier<T>,
    lifetime: ServiceLifetime,
    factory: () => T,
    instance: T | undefined,
    isInstantiated: boolean,
    options?: RegistrationOptions,
  ): void {
    const override = options?.override ?? true;

    if (!override && this.services.has(identifier)) {
      throw new ContainerError(
        `A service is already registered for identifier: ${String(identifier)}`,
      );
    }

    this.services.set(identifier, {
      lifetime,
      factory,
      instance,
      isInstantiated,
    });
  }
}
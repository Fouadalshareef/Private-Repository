import type { BootstrapResult } from './BootstrapResult.js';

/**
 * Contract for the application bootstrap.
 *
 * The bootstrap is responsible for creating and configuring the core
 * foundation services: the dependency injection container, the
 * configuration manager, the logger, and the event bus.
 *
 * Implementations must not perform any business logic — they only
 * initialize the core foundation.
 */
export interface IBootstrap {
  /**
   * Initializes the core foundation and returns a fully configured
   * {@link BootstrapResult}.
   *
   * @returns The populated bootstrap result containing the container,
   * configuration, logger, and event bus.
   */
  initialize(): BootstrapResult;
}
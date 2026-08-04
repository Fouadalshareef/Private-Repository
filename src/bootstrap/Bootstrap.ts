import { Container } from '../core/container/Container.js';
import type { IContainer } from '../core/container/IContainer.js';
import type { ServiceIdentifier } from '../core/container/ServiceIdentifier.js';
import { DefaultConfiguration } from '../config/DefaultConfiguration.js';
import type { DefaultConfigShape } from '../config/DefaultConfiguration.js';
import type { IConfiguration } from '../config/IConfiguration.js';
import { Logger } from '../logging/Logger.js';
import { LogLevel } from '../logging/LogLevel.js';
import type { ILogger } from '../logging/ILogger.js';
import { EventBus } from '../events/EventBus.js';
import type { IEventBus } from '../events/IEventBus.js';
import type { IBootstrap } from './IBootstrap.js';
import type { BootstrapContext } from './BootstrapContext.js';
import { createDefaultBootstrapContext } from './BootstrapContext.js';
import type { BootstrapResult } from './BootstrapResult.js';

/** Service identifier for the dependency injection container. */
export const CONTAINER_IDENTIFIER: ServiceIdentifier<IContainer> = Symbol('Cupaw.Core.Container');

/** Service identifier for the configuration manager. */
export const CONFIGURATION_IDENTIFIER: ServiceIdentifier<IConfiguration<DefaultConfigShape>> =
  Symbol('Cupaw.Core.Configuration');

/** Service identifier for the logger. */
export const LOGGER_IDENTIFIER: ServiceIdentifier<ILogger> = Symbol('Cupaw.Core.Logger');

/** Service identifier for the event bus. */
export const EVENT_BUS_IDENTIFIER: ServiceIdentifier<IEventBus> = Symbol('Cupaw.Core.EventBus');

/**
 * Initializes the Cupaw core foundation.
 *
 * The bootstrap creates and wires the core foundation services:
 * - Dependency Injection Container
 * - Configuration
 * - Logger
 * - Event Bus
 *
 * Every core service is registered into the container so it can be
 * resolved by its service identifier. No business logic is performed.
 */
export class Bootstrap implements IBootstrap {
  private readonly context: BootstrapContext;

  /**
   * Creates a new bootstrap instance.
   * @param context Optional bootstrap context. A default context is used
   * when none is provided.
   */
  constructor(context?: BootstrapContext) {
    this.context = context ?? createDefaultBootstrapContext();
  }

  /**
   * Initializes the core foundation and returns a fully configured
   * {@link BootstrapResult}.
   *
   * @returns The populated bootstrap result containing the container,
   * configuration, logger, and event bus.
   */
  public initialize(): BootstrapResult {
    // 1. Create the Dependency Injection Container.
    const container: IContainer = new Container();

    // 2. Create the Configuration instance pre-filled with foundational defaults.
    const configuration: IConfiguration<DefaultConfigShape> = new DefaultConfiguration();

    // 3. Create the Logger instance.
    const logger: ILogger = new Logger(this.context.options.logLevel ?? LogLevel.INFO);

    // 4. Create the Event Bus instance.
    const eventBus: IEventBus = new EventBus();

    // 5. Register all core services into the DI Container.
    container.registerInstance(CONTAINER_IDENTIFIER, container);
    container.registerInstance(CONFIGURATION_IDENTIFIER, configuration);
    container.registerInstance(LOGGER_IDENTIFIER, logger);
    container.registerInstance(EVENT_BUS_IDENTIFIER, eventBus);

    // 6. Return the bootstrapped result.
    return {
      container,
      configuration,
      logger,
      eventBus,
    };
  }
}
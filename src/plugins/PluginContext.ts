import type { IContainer } from '../core/container/IContainer.js';
import type { ILogger } from '../logging/ILogger.js';
import type { IConfiguration } from '../config/IConfiguration.js';
import type { IEventBus } from '../events/IEventBus.js';
import type { DefaultConfigShape } from '../config/DefaultConfiguration.js';

/**
 * The context provided to plugins during initialization.
 *
 * Gives plugins access to the core foundation services of the
 * application: the dependency injection container, the logger,
 * the configuration manager, and the event bus.
 *
 * @template TConfig The shape of the configuration exposed to plugins.
 */
export interface PluginContext<
  TConfig extends Record<string, unknown> = DefaultConfigShape,
> {
  /** The dependency injection container with all core services registered. */
  readonly container: IContainer;

  /** The application logger. */
  readonly logger: ILogger;

  /** The application configuration manager. */
  readonly configuration: IConfiguration<TConfig>;

  /** The application event bus. */
  readonly eventBus: IEventBus;
}
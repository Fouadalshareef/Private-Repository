import type { IContainer } from '../core/container/IContainer.js';
import type { IConfiguration } from '../config/IConfiguration.js';
import type { ILogger } from '../logging/ILogger.js';
import type { IEventBus } from '../events/IEventBus.js';
import type { DefaultConfigShape } from '../config/DefaultConfiguration.js';

/**
 * The result of a successful bootstrap initialization.
 *
 * Provides access to the fully configured core foundation services:
 * the dependency injection container, the configuration manager,
 * the logger, and the event bus.
 *
 * @template TConfig The shape of the configuration exposed by the result.
 */
export interface BootstrapResult<
  TConfig extends Record<string, unknown> = DefaultConfigShape,
> {
  /** The dependency injection container with all core services registered. */
  readonly container: IContainer;

  /** The configuration manager populated with foundational defaults. */
  readonly configuration: IConfiguration<TConfig>;

  /** The logger instance used by the application. */
  readonly logger: ILogger;

  /** The event bus used for synchronous event publication. */
  readonly eventBus: IEventBus;
}
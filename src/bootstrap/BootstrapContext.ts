import type { LogLevel } from '../logging/LogLevel.js';

/**
 * Options that can be supplied to the bootstrap to influence how the
 * core foundation is initialized.
 *
 * Intentionally minimal for the current version. Add new optional
 * fields here as future boot phases (workspace, plugins, AI, etc.)
 * are introduced.
 */
export interface BootstrapContextOptions {
  /** The minimum log level for the foundation logger. */
  logLevel?: LogLevel;
}

/**
 * Strongly typed initialization context for the application bootstrap.
 *
 * Designed to be generic over options so future expansion can be
 * added without changing the public bootstrap contract.
 *
 * @template TOptions The shape of the bootstrap options.
 */
export interface BootstrapContext<
  TOptions extends BootstrapContextOptions = BootstrapContextOptions,
> {
  /** Options consumed during bootstrap initialization. */
  readonly options: TOptions;
}

/**
 * Creates a strongly typed bootstrap context from the given options.
 *
 * @param options The bootstrap options.
 * @template TOptions The shape of the bootstrap options.
 */
export function createBootstrapContext<
  TOptions extends BootstrapContextOptions = BootstrapContextOptions,
>(options: TOptions): BootstrapContext<TOptions> {
  return { options };
}

/**
 * Creates the default bootstrap context used when none is provided.
 */
export function createDefaultBootstrapContext(): BootstrapContext {
  return { options: {} };
}
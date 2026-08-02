/**
 * Contract for a logging service.
 */
export interface ILogger {
  /** Logs a debug-level message. */
  debug(message: string, ...args: unknown[]): void;

  /** Logs an info-level message. */
  info(message: string, ...args: unknown[]): void;

  /** Logs a warning-level message. */
  warn(message: string, ...args: unknown[]): void;

  /** Logs an error-level message. */
  error(message: string, ...args: unknown[]): void;
}

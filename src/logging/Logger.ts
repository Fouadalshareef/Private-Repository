import { LogLevel } from './LogLevel.js';
import type { ILogger } from './ILogger.js';

/**
 * A basic, console-based logger implementation.
 */
export class Logger implements ILogger {
  private currentLevel: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.currentLevel = level;
  }

  /**
   * Updates the active log level filter.
   * @param level The new minimum log level.
   */
  public setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Formats a log message with a timestamp and severity level.
   * @param level The string representation of the log level.
   * @param message The core message.
   * @returns The formatted log string.
   */
  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  public debug(message: string, ...args: unknown[]): void {
    if (this.currentLevel <= LogLevel.DEBUG) {
      console.debug(this.formatMessage('DEBUG', message), ...args);
    }
  }

  public info(message: string, ...args: unknown[]): void {
    if (this.currentLevel <= LogLevel.INFO) {
      console.info(this.formatMessage('INFO', message), ...args);
    }
  }

  public warn(message: string, ...args: unknown[]): void {
    if (this.currentLevel <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message), ...args);
    }
  }

  public error(message: string, ...args: unknown[]): void {
    if (this.currentLevel <= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', message), ...args);
    }
  }
}

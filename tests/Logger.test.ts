import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../src/logging/Logger.js';
import { LogLevel } from '../src/logging/LogLevel.js';

describe('Logger', () => {
  let consoleDebugMock: ReturnType<typeof vi.spyOn>;
  let consoleInfoMock: ReturnType<typeof vi.spyOn>;
  let consoleWarnMock: ReturnType<typeof vi.spyOn>;
  let consoleErrorMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on console methods and prevent them from actually printing to the test output
    consoleDebugMock = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoMock = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnMock = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Freeze time for consistent timestamp testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-03T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should log debug messages when level is DEBUG', () => {
    const logger = new Logger(LogLevel.DEBUG);
    logger.debug('test debug', { a: 1 });

    expect(consoleDebugMock).toHaveBeenCalledWith('[2026-08-03T00:00:00.000Z] [DEBUG] test debug', {
      a: 1,
    });
  });

  it('should not log debug messages when level is INFO', () => {
    const logger = new Logger(LogLevel.INFO);
    logger.debug('test debug');

    expect(consoleDebugMock).not.toHaveBeenCalled();
  });

  it('should log info messages', () => {
    const logger = new Logger(LogLevel.INFO);
    logger.info('test info');

    expect(consoleInfoMock).toHaveBeenCalledWith('[2026-08-03T00:00:00.000Z] [INFO] test info');
  });

  it('should log warn messages', () => {
    const logger = new Logger(LogLevel.WARN);
    logger.warn('test warn');

    expect(consoleWarnMock).toHaveBeenCalledWith('[2026-08-03T00:00:00.000Z] [WARN] test warn');
  });

  it('should log error messages', () => {
    const logger = new Logger(LogLevel.ERROR);
    logger.error('test error');

    expect(consoleErrorMock).toHaveBeenCalledWith('[2026-08-03T00:00:00.000Z] [ERROR] test error');
  });

  it('should filter logs below WARN level', () => {
    const logger = new Logger(LogLevel.WARN);
    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');

    expect(consoleDebugMock).not.toHaveBeenCalled();
    expect(consoleInfoMock).not.toHaveBeenCalled();
    expect(consoleWarnMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
  });

  it('should allow changing log level dynamically', () => {
    const logger = new Logger(LogLevel.INFO);
    logger.debug('debug 1');
    expect(consoleDebugMock).not.toHaveBeenCalled();

    logger.setLevel(LogLevel.DEBUG);
    logger.debug('debug 2');
    expect(consoleDebugMock).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Bootstrap } from '../src/bootstrap/Bootstrap.js';
import {
  CONTAINER_IDENTIFIER,
  CONFIGURATION_IDENTIFIER,
  LOGGER_IDENTIFIER,
  EVENT_BUS_IDENTIFIER,
} from '../src/bootstrap/Bootstrap.js';
import { LogLevel } from '../src/logging/LogLevel.js';
import type { IContainer } from '../src/core/container/IContainer.js';
import type { IConfiguration } from '../src/config/IConfiguration.js';
import type { ILogger } from '../src/logging/ILogger.js';
import type { IEventBus } from '../src/events/IEventBus.js';

describe('Bootstrap', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── bootstrap initialization ─────────────────────────────────

  it('should initialize and return a BootstrapResult', () => {
    const bootstrap = new Bootstrap();
    const result = bootstrap.initialize();

    expect(result).toBeDefined();
    expect(result.container).toBeDefined();
    expect(result.configuration).toBeDefined();
    expect(result.logger).toBeDefined();
    expect(result.eventBus).toBeDefined();
  });

  it('should create a fresh container on every initialize call', () => {
    const bootstrap = new Bootstrap();
    const first = bootstrap.initialize();
    const second = bootstrap.initialize();

    expect(first.container).not.toBe(second.container);
  });

  it('should create a fresh configuration on every initialize call', () => {
    const bootstrap = new Bootstrap();
    const first = bootstrap.initialize();
    const second = bootstrap.initialize();

    expect(first.configuration).not.toBe(second.configuration);
  });

  it('should create a fresh logger on every initialize call', () => {
    const bootstrap = new Bootstrap();
    const first = bootstrap.initialize();
    const second = bootstrap.initialize();

    expect(first.logger).not.toBe(second.logger);
  });

  it('should create a fresh event bus on every initialize call', () => {
    const bootstrap = new Bootstrap();
    const first = bootstrap.initialize();
    const second = bootstrap.initialize();

    expect(first.eventBus).not.toBe(second.eventBus);
  });

  it('should not share state between two Bootstrap instances', () => {
    const bootstrapA = new Bootstrap();
    const bootstrapB = new Bootstrap();

    const resultA = bootstrapA.initialize();
    const resultB = bootstrapB.initialize();

    expect(resultA.container).not.toBe(resultB.container);
    expect(resultA.configuration).not.toBe(resultB.configuration);
    expect(resultA.logger).not.toBe(resultB.logger);
    expect(resultA.eventBus).not.toBe(resultB.eventBus);
  });

  // ── service registration ────────────────────────────────────

  it('should register the container as a core service', () => {
    const bootstrap = new Bootstrap();
    const result = bootstrap.initialize();

    expect(result.container.has(CONTAINER_IDENTIFIER)).toBe(true);
  });

  it('should register the configuration as a core service', () => {
    const bootstrap = new Bootstrap();
    const result = bootstrap.initialize();

    expect(result.container.has(CONFIGURATION_IDENTIFIER)).toBe(true);
  });

  it('should register the logger as a core service', () => {
    const bootstrap = new Bootstrap();
    const result = bootstrap.initialize();

    expect(result.container.has(LOGGER_IDENTIFIER)).toBe(true);
  });

  it('should register the event bus as a core service', () => {
    const bootstrap = new Bootstrap();
    const result = bootstrap.initialize();

    expect(result.container.has(EVENT_BUS_IDENTIFIER)).toBe(true);
  });

  // ── resolving registered services ────────────────────────────

  it('should resolve the container from the DI container', () => {
    const bootstrap = new Bootstrap();
    const result = bootstrap.initialize();

    const resolved = result.container.resolve(CONTAINER_IDENTIFIER);
    expect(resolved).toBe(result.container);
  });

  it('should resolve the configuration from the DI container', () => {
    const bootstrap = new Bootstrap();
    const result = bootstrap.initialize();

    const resolved = result.container.resolve(CONFIGURATION_IDENTIFIER);
    expect(resolved).toBe(result.configuration);
  });

  it('should resolve the logger from the DI container', () => {
    const bootstrap = new Bootstrap();
    const result = bootstrap.initialize();

    const resolved = result.container.resolve(LOGGER_IDENTIFIER);
    expect(resolved).toBe(result.logger);
  });

  it('should resolve the event bus from the DI container', () => {
    const bootstrap = new Bootstrap();
    const result = bootstrap.initialize();

    const resolved = result.container.resolve(EVENT_BUS_IDENTIFIER);
    expect(resolved).toBe(result.eventBus);
  });

  it('should resolve the same instance on repeated resolves', () => {
    const bootstrap = new Bootstrap();
    const result = bootstrap.initialize();

    const containerA = result.container.resolve(CONTAINER_IDENTIFIER);
    const containerB = result.container.resolve(CONTAINER_IDENTIFIER);
    const configA = result.container.resolve(CONFIGURATION_IDENTIFIER);
    const configB = result.container.resolve(CONFIGURATION_IDENTIFIER);
    const loggerA = result.container.resolve(LOGGER_IDENTIFIER);
    const loggerB = result.container.resolve(LOGGER_IDENTIFIER);
    const eventBusA = result.container.resolve(EVENT_BUS_IDENTIFIER);
    const eventBusB = result.container.resolve(EVENT_BUS_IDENTIFIER);

    expect(containerA).toBe(containerB);
    expect(configA).toBe(configB);
    expect(loggerA).toBe(loggerB);
    expect(eventBusA).toBe(eventBusB);
  });

  // ── returned BootstrapResult ─────────────────────────────────

  it('should return a container that is an IContainer', () => {
    const bootstrap = new Bootstrap();
    const result = bootstrap.initialize();
    const container: IContainer = result.container;

    expect(container.register).toBeTypeOf('function');
    expect(container.resolve).toBeTypeOf('function');
    expect(container.has).toBeTypeOf('function');
  });

  it('should return a configuration that is an IConfiguration', () => {
    const bootstrap = new Bootstrap();
    const result = bootstrap.initialize();
    const configuration: IConfiguration<Record<string, unknown>> = result.configuration;

    expect(configuration.get).toBeTypeOf('function');
    expect(configuration.set).toBeTypeOf('function');
    expect(configuration.has).toBeTypeOf('function');
    expect(configuration.reset).toBeTypeOf('function');
  });

  it('should return a logger that is an ILogger', () => {
    const bootstrap = new Bootstrap();
    const result = bootstrap.initialize();
    const logger: ILogger = result.logger;

    expect(logger.debug).toBeTypeOf('function');
    expect(logger.info).toBeTypeOf('function');
    expect(logger.warn).toBeTypeOf('function');
    expect(logger.error).toBeTypeOf('function');
  });

  it('should return an event bus that is an IEventBus', () => {
    const bootstrap = new Bootstrap();
    const result = bootstrap.initialize();
    const eventBus: IEventBus = result.eventBus;

    expect(eventBus.publish).toBeTypeOf('function');
    expect(eventBus.subscribe).toBeTypeOf('function');
    expect(eventBus.unsubscribe).toBeTypeOf('function');
    expect(eventBus.clear).toBeTypeOf('function');
  });

  it('should return a configuration with foundational defaults', () => {
    const bootstrap = new Bootstrap();
    const result = bootstrap.initialize();

    expect(result.configuration.get('logLevel')).toBe('INFO');
    expect(result.configuration.get('maxMemory')).toBe(1024);
    expect(result.configuration.get('environment')).toBe('development');
  });

  // ── bootstrap context ────────────────────────────────────────

  it('should activate debug logging when DEBUG level is configured', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    const bootstrap = new Bootstrap({ options: { logLevel: LogLevel.DEBUG } });
    const result = bootstrap.initialize();

    result.logger.debug('bootstrap debug message');
    expect(debugSpy).toHaveBeenCalled();
  });

  it('should not log debug messages when default INFO level is used', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    const bootstrap = new Bootstrap();
    const result = bootstrap.initialize();

    result.logger.debug('bootstrap debug message');
    expect(debugSpy).not.toHaveBeenCalled();
  });
});
import { describe, it, expect, beforeEach } from 'vitest';
import { Configuration } from '../src/config/Configuration.js';

type TestConfig = {
  apiUrl: string;
  timeout: number;
  retries: number;
};

describe('Configuration', () => {
  let config: Configuration<TestConfig>;

  beforeEach(() => {
    config = new Configuration<TestConfig>({
      timeout: 5000,
      retries: 3,
    });
  });

  it('should get a value if it exists', () => {
    expect(config.get('timeout')).toBe(5000);
  });

  it('should return undefined if a value does not exist and no default was set', () => {
    expect(config.get('apiUrl')).toBeUndefined();
  });

  it('should return defaultValue via getOrDefault if value is missing', () => {
    expect(config.getOrDefault('apiUrl', 'http://localhost')).toBe('http://localhost');
  });

  it('should return actual value via getOrDefault if value exists', () => {
    expect(config.getOrDefault('timeout', 1000)).toBe(5000);
  });

  it('should set and get a value', () => {
    config.set('apiUrl', 'https://api.example.com');
    expect(config.get('apiUrl')).toBe('https://api.example.com');
  });

  it('should check if a value exists using has', () => {
    expect(config.has('retries')).toBe(true);
    expect(config.has('apiUrl')).toBe(false);
  });

  it('should reset to default values', () => {
    config.set('timeout', 10000);
    expect(config.get('timeout')).toBe(10000);

    config.reset();
    expect(config.get('timeout')).toBe(5000);
    expect(config.has('apiUrl')).toBe(false);
  });

  it('should support multiple instances independently', () => {
    const config1 = new Configuration<TestConfig>({ timeout: 1000 });
    const config2 = new Configuration<TestConfig>({ timeout: 2000 });

    config1.set('retries', 1);
    config2.set('retries', 5);

    expect(config1.get('timeout')).toBe(1000);
    expect(config2.get('timeout')).toBe(2000);
    expect(config1.get('retries')).toBe(1);
    expect(config2.get('retries')).toBe(5);
  });
});

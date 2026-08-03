import type { IConfiguration } from './IConfiguration.js';

/**
 * An in-memory, strongly-typed configuration manager.
 * Allows multiple instances without relying on singletons.
 * @template TConfig The strongly-typed shape of the configuration.
 */
export class Configuration<
  TConfig extends Record<string, unknown>,
> implements IConfiguration<TConfig> {
  private config: Partial<TConfig>;
  private defaultValues: Partial<TConfig>;

  /**
   * Initializes a new configuration instance.
   * @param defaultValues Optional default values to populate initially and use upon reset.
   */
  constructor(defaultValues?: Partial<TConfig>) {
    this.defaultValues = defaultValues ? { ...defaultValues } : {};
    this.config = { ...this.defaultValues };
  }

  public get<K extends keyof TConfig>(key: K): TConfig[K] | undefined {
    return this.config[key];
  }

  public getOrDefault<K extends keyof TConfig>(key: K, defaultValue: TConfig[K]): TConfig[K] {
    const value = this.config[key];
    return value !== undefined ? (value as TConfig[K]) : defaultValue;
  }

  public set<K extends keyof TConfig>(key: K, value: TConfig[K]): void {
    this.config[key] = value;
  }

  public has<K extends keyof TConfig>(key: K): boolean {
    return this.config[key] !== undefined;
  }

  public reset(): void {
    this.config = { ...this.defaultValues };
  }
}

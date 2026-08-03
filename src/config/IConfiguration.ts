/**
 * Contract for a strongly-typed generic configuration manager.
 * @template TConfig The interface representing the structure of the configuration.
 */
export interface IConfiguration<TConfig extends Record<string, unknown>> {
  /** Retrieves a value by its key, or undefined if not present. */
  get<K extends keyof TConfig>(key: K): TConfig[K] | undefined;

  /** Retrieves a value by its key, returning the provided defaultValue if not present. */
  getOrDefault<K extends keyof TConfig>(key: K, defaultValue: TConfig[K]): TConfig[K];

  /** Sets or overrides a value for a specific key. */
  set<K extends keyof TConfig>(key: K, value: TConfig[K]): void;

  /** Returns true if a value is set for the key. */
  has<K extends keyof TConfig>(key: K): boolean;

  /** Resets the configuration back to its initial default state. */
  reset(): void;
}

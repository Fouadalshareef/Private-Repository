import type { IAIProvider } from './IAIProvider.js';
import { AIProviderType } from './AIProviderType.js';
import { ProviderNotFoundError } from './AIProviderError.js';

/**
 * Registry for managing AI providers.
 *
 * This registry allows registering, unregistering, and looking up AI providers
 * by their type and name.
 */
export class AIProviderRegistry {
  private readonly providers: Map<string, IAIProvider> = new Map();

  /**
   * Registers an AI provider with the registry.
   *
   * @param provider The provider to register.
   * @throws {Error} If a provider with the same key already exists.
   */
  register(provider: IAIProvider): void {
    const key = this.getProviderKey(provider.getProviderInfo().type, provider.getProviderInfo().name);
    if (this.providers.has(key)) {
      throw new Error(`AI provider '${key}' is already registered.`);
    }
    this.providers.set(key, provider);
  }

  /**
   * Unregisters an AI provider from the registry.
   *
   * @param providerType The type of the provider.
   * @param providerName The name of the provider.
   * @throws {ProviderNotFoundError} If the provider is not found.
   */
  unregister(providerType: AIProviderType, providerName: string): void {
    const key = this.getProviderKey(providerType, providerName);
    if (!this.providers.has(key)) {
      throw new ProviderNotFoundError(providerType, providerName);
    }
    this.providers.delete(key);
  }

  /**
   * Retrieves an AI provider by type and name.
   *
   * @param providerType The type of the provider.
   * @param providerName The name of the provider.
   * @returns The provider instance.
   * @throws {ProviderNotFoundError} If the provider is not found.
   */
  get(providerType: AIProviderType, providerName: string): IAIProvider {
    const key = this.getProviderKey(providerType, providerName);
    const provider = this.providers.get(key);
    if (!provider) {
      throw new ProviderNotFoundError(providerType, providerName);
    }
    return provider;
  }

  /**
   * Checks if a provider is registered.
   *
   * @param providerType The type of the provider.
   * @param providerName The name of the provider.
   * @returns True if the provider is registered, false otherwise.
   */
  has(providerType: AIProviderType, providerName: string): boolean {
    return this.providers.has(this.getProviderKey(providerType, providerName));
  }

  /**
   * Returns all registered providers.
   *
   * @returns An array of all registered providers.
   */
  getAll(): IAIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Returns the number of registered providers.
   *
   * @returns The number of registered providers.
   */
  get size(): number {
    return this.providers.size;
  }

  /**
   * Clears all registered providers.
   */
  clear(): void {
    this.providers.clear();
  }

  /**
   * Generates a unique key for a provider.
   */
  private getProviderKey(providerType: AIProviderType, providerName: string): string {
    return `${providerType}:${providerName}`;
  }
}
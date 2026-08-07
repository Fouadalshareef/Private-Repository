import type { IAIProvider } from './IAIProvider.js';
import { AIProviderType } from './AIProviderType.js';
import { ProviderNotFoundError } from './AIProviderError.js';
import { MockProvider, type MockProviderOptions } from './providers/MockProvider.js';
import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { GeminiProvider } from './providers/GeminiProvider.js';
import { AnthropicProvider } from './providers/AnthropicProvider.js';
import { OpenRouterProvider } from './providers/OpenRouterProvider.js';
import { OllamaProvider } from './providers/OllamaProvider.js';

/**
 * Configuration for creating an AI provider via the factory.
 */
export interface AIProviderFactoryConfig {
  readonly provider: AIProviderType;
  readonly apiKey?: string;
  readonly model?: string;
  readonly baseURL?: string;
  readonly organization?: string;
  readonly isAvailable?: boolean;
}

/**
 * Factory for creating AI provider instances.
 *
 * Reads configuration and returns the appropriate provider implementation.
 */
export class AIProviderFactory {
  /**
   * Creates an AI provider instance based on the configuration.
   *
   * @param config The provider configuration.
   * @returns An IAIProvider instance.
   * @throws {ProviderNotFoundError} If the provider type is not supported.
   */
  static createProvider(config: AIProviderFactoryConfig): IAIProvider {
    const providerType = config.provider;

    switch (providerType) {
      case AIProviderType.MOCK:
        return new MockProvider({
          isAvailable: config.isAvailable,
          models: config.model ? [config.model] : undefined,
        } as MockProviderOptions);

      case AIProviderType.OPENAI:
        return new OpenAIProvider({
          apiKey: config.apiKey,
          model: config.model,
          baseURL: config.baseURL,
          organization: config.organization,
          isAvailable: config.isAvailable,
        });

      case AIProviderType.GEMINI:
        return new GeminiProvider({
          apiKey: config.apiKey,
          model: config.model,
          isAvailable: config.isAvailable,
        });

      case AIProviderType.ANTHROPIC:
        return new AnthropicProvider({
          apiKey: config.apiKey,
          model: config.model,
          isAvailable: config.isAvailable,
        });

      case AIProviderType.OPENROUTER:
        return new OpenRouterProvider({
          apiKey: config.apiKey,
          model: config.model,
          baseURL: config.baseURL,
          isAvailable: config.isAvailable,
        });

      case AIProviderType.OLLAMA:
        return new OllamaProvider({
          model: config.model,
          isAvailable: config.isAvailable,
        });

      default:
        throw new ProviderNotFoundError(providerType, 'unknown');
    }
  }
}

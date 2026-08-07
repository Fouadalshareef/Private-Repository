import { describe, it, expect } from 'vitest';
import { AIProviderFactory } from '../../src/ai/AIProviderFactory.js';
import { AIProviderType } from '../../src/ai/AIProviderType.js';
import { ProviderHealthStatus } from '../../src/ai/ProviderHealthStatus.js';
import { MockProvider } from '../../src/ai/providers/MockProvider.js';
import { OpenAIProvider } from '../../src/ai/providers/OpenAIProvider.js';
import { GeminiProvider } from '../../src/ai/providers/GeminiProvider.js';
import { AnthropicProvider } from '../../src/ai/providers/AnthropicProvider.js';
import { OpenRouterProvider } from '../../src/ai/providers/OpenRouterProvider.js';
import { OllamaProvider } from '../../src/ai/providers/OllamaProvider.js';
import { AIConfig } from '../../src/config/AIConfig.js';
import { EnvironmentLoader } from '../../src/config/EnvironmentLoader.js';

describe('AIProviderFactory', () => {
  describe('createProvider', () => {
    it('should create a MockProvider for MOCK type', () => {
      const provider = AIProviderFactory.createProvider({ provider: AIProviderType.MOCK });
      expect(provider).toBeInstanceOf(MockProvider);
    });

    it('should create an OpenAIProvider for OPENAI type', () => {
      const provider = AIProviderFactory.createProvider({ provider: AIProviderType.OPENAI });
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should create a GeminiProvider for GEMINI type', () => {
      const provider = AIProviderFactory.createProvider({ provider: AIProviderType.GEMINI });
      expect(provider).toBeInstanceOf(GeminiProvider);
    });

    it('should create an AnthropicProvider for ANTHROPIC type', () => {
      const provider = AIProviderFactory.createProvider({ provider: AIProviderType.ANTHROPIC });
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it('should create an OpenRouterProvider for OPENROUTER type', () => {
      const provider = AIProviderFactory.createProvider({ provider: AIProviderType.OPENROUTER });
      expect(provider).toBeInstanceOf(OpenRouterProvider);
    });

    it('should create an OllamaProvider for OLLAMA type', () => {
      const provider = AIProviderFactory.createProvider({ provider: AIProviderType.OLLAMA });
      expect(provider).toBeInstanceOf(OllamaProvider);
    });

    it('should pass apiKey to OpenAIProvider', () => {
      const provider = AIProviderFactory.createProvider({
        provider: AIProviderType.OPENAI,
        apiKey: 'test-key',
      });
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should throw for unknown provider type', () => {
      expect(() => {
        AIProviderFactory.createProvider({ provider: 'unknown' as AIProviderType });
      }).toThrow();
    });
  });
});

describe('ProviderHealthStatus', () => {
  it('should have all expected status values', () => {
    expect(ProviderHealthStatus.READY).toBe('ready');
    expect(ProviderHealthStatus.OFFLINE).toBe('offline');
    expect(ProviderHealthStatus.UNAUTHORIZED).toBe('unauthorized');
    expect(ProviderHealthStatus.RATE_LIMITED).toBe('rate_limited');
    expect(ProviderHealthStatus.UNKNOWN).toBe('unknown');
  });
});

describe('AIConfig', () => {
  it('should create with default values', () => {
    const config = new AIConfig();
    expect(config.get('provider')).toBe(AIProviderType.MOCK);
    expect(config.get('model')).toBe('mock-model-v1');
    expect(config.get('temperature')).toBe(0.7);
  });

  it('should allow setting and getting values', () => {
    const config = new AIConfig();
    config.set('provider', AIProviderType.OPENAI);
    config.set('model', 'gpt-4o');
    expect(config.get('provider')).toBe(AIProviderType.OPENAI);
    expect(config.get('model')).toBe('gpt-4o');
  });

  it('should reset to defaults', () => {
    const config = new AIConfig();
    config.set('provider', AIProviderType.OPENAI);
    config.reset();
    expect(config.get('provider')).toBe(AIProviderType.MOCK);
  });
});

describe('EnvironmentLoader', () => {
  it('should load AI environment variables', () => {
    const loader = new EnvironmentLoader({
      OPENAI_API_KEY: 'openai-key',
      GEMINI_API_KEY: 'gemini-key',
      ANTHROPIC_API_KEY: 'anthropic-key',
      OPENROUTER_API_KEY: 'openrouter-key',
      OLLAMA_HOST: 'http://localhost:11434',
    });

    const env = loader.loadAIEnv();
    expect(env.openaiApiKey).toBe('openai-key');
    expect(env.geminiApiKey).toBe('gemini-key');
    expect(env.anthropicApiKey).toBe('anthropic-key');
    expect(env.openrouterApiKey).toBe('openrouter-key');
    expect(env.ollamaHost).toBe('http://localhost:11434');
  });

  it('should return undefined for missing keys', () => {
    const loader = new EnvironmentLoader({});
    const env = loader.loadAIEnv();
    expect(env.openaiApiKey).toBeUndefined();
    expect(env.geminiApiKey).toBeUndefined();
  });
});

describe('Providers', () => {
  describe('MockProvider', () => {
    it('should implement all IAIProvider methods', async () => {
      const provider = new MockProvider();
      const messages = [{ role: 'user', content: 'hello' }];

      expect(provider.getProviderType()).toBe(AIProviderType.MOCK);
      expect(await provider.complete(messages)).toBeDefined();
      expect(await provider.countTokens(messages)).toBeGreaterThan(0);
      expect(await provider.listModels()).toEqual(['mock-model-v1']);
      expect(await provider.healthCheck()).toBe(ProviderHealthStatus.READY);
      expect(provider.supportsTools()).toBe(false);
      expect(provider.supportsVision()).toBe(false);
      expect(provider.supportsStreaming()).toBe(true);
    });
  });

  describe('OpenAIProvider', () => {
    it('should report correct capabilities', async () => {
      const provider = new OpenAIProvider();
      expect(provider.getProviderType()).toBe(AIProviderType.OPENAI);
      expect(provider.supportsTools()).toBe(true);
      expect(provider.supportsVision()).toBe(true);
      expect(provider.supportsStreaming()).toBe(true);
    });
  });

  describe('GeminiProvider', () => {
    it('should report correct capabilities', async () => {
      const provider = new GeminiProvider();
      expect(provider.getProviderType()).toBe(AIProviderType.GEMINI);
      expect(provider.supportsTools()).toBe(true);
      expect(provider.supportsVision()).toBe(true);
      expect(provider.supportsStreaming()).toBe(true);
    });
  });

  describe('AnthropicProvider', () => {
    it('should report correct capabilities', async () => {
      const provider = new AnthropicProvider();
      expect(provider.getProviderType()).toBe(AIProviderType.ANTHROPIC);
      expect(provider.supportsTools()).toBe(true);
      expect(provider.supportsVision()).toBe(true);
      expect(provider.supportsStreaming()).toBe(true);
    });
  });

  describe('OpenRouterProvider', () => {
    it('should report correct capabilities', async () => {
      const provider = new OpenRouterProvider();
      expect(provider.getProviderType()).toBe(AIProviderType.OPENROUTER);
      expect(provider.supportsTools()).toBe(true);
      expect(provider.supportsVision()).toBe(true);
      expect(provider.supportsStreaming()).toBe(true);
    });
  });

  describe('OllamaProvider', () => {
    it('should report correct capabilities', async () => {
      const provider = new OllamaProvider();
      expect(provider.getProviderType()).toBe(AIProviderType.OLLAMA);
      expect(provider.supportsTools()).toBe(false);
      expect(provider.supportsVision()).toBe(false);
      expect(provider.supportsStreaming()).toBe(true);
    });
  });
});

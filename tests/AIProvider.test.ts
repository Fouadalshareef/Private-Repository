import { describe, it, expect, beforeEach } from 'vitest';
import { AIProviderType } from '../src/ai/AIProviderType.js';
import { MessageRole, createAIMessage, systemMessage, userMessage, assistantMessage, toolMessage } from '../src/ai/AIMessage.js';
import { FinishReason, createTokenUsage, AIResponse, createAIResponse } from '../src/ai/AIResponse.js';
import { AIProviderError, ProviderNotFoundError, APIKeyMissingError, ProviderResponseError, ProviderStreamError } from '../src/ai/AIProviderError.js';
import { AIProviderEvents } from '../src/ai/AIProviderEvents.js';
import { IAIProvider } from '../src/ai/IAIProvider.js';
import { AIProviderRegistry } from '../src/ai/AIProviderRegistry.js';
import { MockAIProvider } from '../src/ai/MockAIProvider.js';

describe('AIProviderType', () => {
  it('should have correct provider types', () => {
    expect(AIProviderType.OPENAI).toBe('openai');
    expect(AIProviderType.ANTHROPIC).toBe('anthropic');
    expect(AIProviderType.OLLAMA).toBe('ollama');
    expect(AIProviderType.MOCK).toBe('mock');
  });
});

describe('AIMessage', () => {
  it('should create a message with createAIMessage', () => {
    const message = createAIMessage(MessageRole.USER, 'Hello');
    expect(message.role).toBe(MessageRole.USER);
    expect(message.content).toBe('Hello');
    expect(message.name).toBeUndefined();
    expect(message.toolCallId).toBeUndefined();
  });

  it('should create a message with options', () => {
    const message = createAIMessage(MessageRole.TOOL, 'Result', { name: 'tool1', toolCallId: 'call-123' });
    expect(message.role).toBe(MessageRole.TOOL);
    expect(message.content).toBe('Result');
    expect(message.name).toBe('tool1');
    expect(message.toolCallId).toBe('call-123');
  });

  it('should create system message', () => {
    const message = systemMessage('You are a helpful assistant.');
    expect(message.role).toBe(MessageRole.SYSTEM);
    expect(message.content).toBe('You are a helpful assistant.');
  });

  it('should create user message', () => {
    const message = userMessage('Hello!');
    expect(message.role).toBe(MessageRole.USER);
    expect(message.content).toBe('Hello!');
  });

  it('should create assistant message', () => {
    const message = assistantMessage('Hi there!');
    expect(message.role).toBe(MessageRole.ASSISTANT);
    expect(message.content).toBe('Hi there!');
  });

  it('should create tool message', () => {
    const message = toolMessage('Tool result', 'call-456');
    expect(message.role).toBe(MessageRole.TOOL);
    expect(message.content).toBe('Tool result');
    expect(message.toolCallId).toBe('call-456');
  });
});

describe('AIResponse', () => {
  it('should create token usage with createTokenUsage', () => {
    const usage = createTokenUsage({ promptTokens: 10, completionTokens: 20, totalTokens: 30 });
    expect(usage.promptTokens).toBe(10);
    expect(usage.completionTokens).toBe(20);
    expect(usage.totalTokens).toBe(30);
  });

  it('should create AI response with createAIResponse', () => {
    const response: AIResponse = {
      content: 'Hello!',
      finishReason: FinishReason.STOP,
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      model: 'gpt-4',
      metadata: { custom: 'data' },
    };
    const copied = createAIResponse(response);
    expect(copied.content).toBe('Hello!');
    expect(copied.finishReason).toBe(FinishReason.STOP);
    expect(copied.usage.promptTokens).toBe(10);
    expect(copied.model).toBe('gpt-4');
    expect(copied.metadata).toEqual({ custom: 'data' });
  });

  it('should handle response without metadata', () => {
    const response: AIResponse = {
      content: 'Test',
      finishReason: FinishReason.LENGTH,
      usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
      model: 'test-model',
    };
    const copied = createAIResponse(response);
    expect(copied.metadata).toBeUndefined();
  });
});

describe('AIProviderError', () => {
  it('should create base AIProviderError', () => {
    const error = new AIProviderError(AIProviderType.OPENAI, 'openai', 'Test error');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AIProviderError');
    expect(error.providerType).toBe(AIProviderType.OPENAI);
    expect(error.providerName).toBe('openai');
    expect(error.message).toBe('Test error');
  });

  it('should create ProviderNotFoundError', () => {
    const error = new ProviderNotFoundError(AIProviderType.ANTHROPIC, 'claude');
    expect(error).toBeInstanceOf(AIProviderError);
    expect(error.name).toBe('ProviderNotFoundError');
    expect(error.message).toContain('claude');
    expect(error.message).toContain('anthropic');
  });

  it('should create APIKeyMissingError', () => {
    const error = new APIKeyMissingError(AIProviderType.OLLAMA, 'local');
    expect(error).toBeInstanceOf(AIProviderError);
    expect(error.name).toBe('APIKeyMissingError');
    expect(error.message).toContain('API key');
  });

  it('should create ProviderResponseError with status code', () => {
    const error = new ProviderResponseError(AIProviderType.OPENAI, 'openai', 'Bad request', 400, 'Invalid parameters');
    expect(error).toBeInstanceOf(AIProviderError);
    expect(error.name).toBe('ProviderResponseError');
    expect(error.statusCode).toBe(400);
    expect(error.responseBody).toBe('Invalid parameters');
  });

  it('should create ProviderStreamError', () => {
    const error = new ProviderStreamError(AIProviderType.MOCK, 'mock', 'Stream interrupted');
    expect(error).toBeInstanceOf(AIProviderError);
    expect(error.name).toBe('ProviderStreamError');
  });
});

describe('AIProviderEvents', () => {
  it('should have correct event names', () => {
    expect(AIProviderEvents.COMPLETION_STARTED).toBe('ai.provider.completion.started');
    expect(AIProviderEvents.COMPLETION_FINISHED).toBe('ai.provider.completion.finished');
    expect(AIProviderEvents.COMPLETION_FAILED).toBe('ai.provider.completion.failed');
    expect(AIProviderEvents.STREAM_CHUNK).toBe('ai.provider.stream.chunk');
    expect(AIProviderEvents.STREAM_STARTED).toBe('ai.provider.stream.started');
    expect(AIProviderEvents.STREAM_ENDED).toBe('ai.provider.stream.ended');
    expect(AIProviderEvents.STREAM_FAILED).toBe('ai.provider.stream.failed');
    expect(AIProviderEvents.PROVIDER_REGISTERED).toBe('ai.provider.registered');
    expect(AIProviderEvents.PROVIDER_UNREGISTERED).toBe('ai.provider.unregistered');
  });
});

describe('AIProviderRegistry', () => {
  let registry: AIProviderRegistry;

  beforeEach(() => {
    registry = new AIProviderRegistry();
  });

  it('should register a provider', () => {
    const provider = new MockAIProvider({ name: 'test' });
    registry.register(provider);
    expect(registry.size).toBe(1);
    expect(registry.has(AIProviderType.MOCK, 'test')).toBe(true);
  });

  it('should throw when registering duplicate provider', () => {
    const provider1 = new MockAIProvider({ name: 'test' });
    const provider2 = new MockAIProvider({ name: 'test' });
    registry.register(provider1);
    expect(() => registry.register(provider2)).toThrow("AI provider 'mock:test' is already registered.");
  });

  it('should unregister a provider', () => {
    const provider = new MockAIProvider({ name: 'test' });
    registry.register(provider);
    expect(registry.size).toBe(1);
    registry.unregister(AIProviderType.MOCK, 'test');
    expect(registry.size).toBe(0);
    expect(registry.has(AIProviderType.MOCK, 'test')).toBe(false);
  });

  it('should throw when unregistering non-existent provider', () => {
    expect(() => registry.unregister(AIProviderType.MOCK, 'nonexistent')).toThrow(ProviderNotFoundError);
  });

  it('should get a registered provider', () => {
    const provider = new MockAIProvider({ name: 'test' });
    registry.register(provider);
    const retrieved = registry.get(AIProviderType.MOCK, 'test');
    expect(retrieved).toBe(provider);
  });

  it('should throw when getting non-existent provider', () => {
    expect(() => registry.get(AIProviderType.MOCK, 'nonexistent')).toThrow(ProviderNotFoundError);
  });

  it('should return all providers', () => {
    const provider1 = new MockAIProvider({ name: 'test1' });
    const provider2 = new MockAIProvider({ name: 'test2' });
    registry.register(provider1);
    registry.register(provider2);
    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(provider1);
    expect(all).toContain(provider2);
  });

  it('should clear all providers', () => {
    const provider = new MockAIProvider({ name: 'test' });
    registry.register(provider);
    expect(registry.size).toBe(1);
    registry.clear();
    expect(registry.size).toBe(0);
  });
});

describe('MockAIProvider', () => {
  it('should return provider info', () => {
    const provider = new MockAIProvider({ name: 'custom' });
    const info = provider.getProviderInfo();
    expect(info.type).toBe(AIProviderType.MOCK);
    expect(info.name).toBe('custom');
    expect(info.version).toBe('1.0.0');
    expect(info.isAvailable).toBe(true);
  });

  it('should return capabilities', () => {
    const provider = new MockAIProvider();
    const capabilities = provider.getCapabilities();
    expect(capabilities.supportsStreaming).toBe(true);
    expect(capabilities.supportsFunctionCalling).toBe(false);
    expect(capabilities.supportsVision).toBe(false);
    expect(capabilities.maxContextWindow).toBe(4096);
    expect(capabilities.models).toEqual(['mock-model-v1']);
  });

  it('should complete with default response', async () => {
    const provider = new MockAIProvider();
    const messages = [userMessage('Hello')];
    const response = await provider.complete(messages);
    expect(response.content).toBe('Hello! This is a mock AI response.');
    expect(response.finishReason).toBe(FinishReason.STOP);
    expect(response.model).toBe('mock-model-v1');
    expect(response.usage.promptTokens).toBeGreaterThan(0);
  });

  it('should complete with custom response', async () => {
    const provider = new MockAIProvider({ defaultResponse: 'Custom response' });
    const messages = [userMessage('Test')];
    const response = await provider.complete(messages);
    expect(response.content).toBe('Custom response');
  });

  it('should return error response for error input', async () => {
    const provider = new MockAIProvider();
    const messages = [userMessage('This is an error test')];
    const response = await provider.complete(messages);
    expect(response.content).toBe('Mock error response triggered.');
  });

  it('should stream response', async () => {
    const provider = new MockAIProvider({ defaultResponse: 'Hello world' });
    const messages = [userMessage('Test')];
    const chunks: string[] = [];
    for await (const chunk of provider.stream(messages)) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('')).toContain('Hello');
    expect(chunks.join('')).toContain('world');
  });

  it('should report availability', () => {
    const provider = new MockAIProvider({ isAvailable: true });
    expect(provider.isAvailable()).toBe(true);
    provider.setAvailable(false);
    expect(provider.isAvailable()).toBe(false);
  });

  it('should support custom models', () => {
    const provider = new MockAIProvider({ models: ['model-v1', 'model-v2'] });
    const capabilities = provider.getCapabilities();
    expect(capabilities.models).toEqual(['model-v1', 'model-v2']);
  });
});

describe('IAIProvider interface', () => {
  it('should be implemented by MockAIProvider', () => {
    const provider: IAIProvider = new MockAIProvider();
    expect(provider.getProviderInfo).toBeTypeOf('function');
    expect(provider.getCapabilities).toBeTypeOf('function');
    expect(provider.complete).toBeTypeOf('function');
    expect(provider.stream).toBeTypeOf('function');
    expect(provider.isAvailable).toBeTypeOf('function');
  });
});
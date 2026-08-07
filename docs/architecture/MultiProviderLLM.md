# Multi-Provider LLM Runtime Architecture

## 1. Vision

Cupaw must be provider-agnostic. The system should support multiple LLM providers without any component knowing which provider is active. Switching providers should require only a configuration change.

This task builds the **abstraction layer** that makes Cupaw independent of any specific LLM vendor.

## 2. Current Architecture

```
Cupaw
      ↓
MockAIProvider
```

## 3. Target Architecture

```
                IAIProvider
                     │
 ┌──────────┬────────────┬────────────┬────────────┬────────────┬──────────┐
 Mock      OpenAI      Gemini      Claude      Ollama    OpenRouter
                     │
             Agent Executor
                     │
              Advisor Engine
                     │
                    CLI
```

All components depend only on `IAIProvider`. None know the concrete provider type.

## 4. Core Interface

### 4.1 IAIProvider

Extended interface supporting:

```typescript
interface IAIProvider {
  getProviderInfo(): AIProviderInfo;
  getCapabilities(): AIProviderCapabilities;
  complete(messages, options?): Promise<AIResponse>;
  stream(messages, options?): AsyncIterable<string>;
  isAvailable(): boolean;

  // New methods
  getProviderType(): AIProviderType;
  countTokens(messages): Promise<number>;
  listModels(): Promise<string[]>;
  healthCheck(): Promise<ProviderHealthStatus>;
  supportsTools(): boolean;
  supportsVision(): boolean;
  supportsStreaming(): boolean;
}
```

### 4.2 ProviderHealthStatus

```typescript
enum ProviderHealthStatus {
  READY = 'ready',
  OFFLINE = 'offline',
  UNAUTHORIZED = 'unauthorized',
  RATE_LIMITED = 'rate_limited',
  UNKNOWN = 'unknown',
}
```

## 5. Provider Hierarchy

### 5.1 BaseProvider

Abstract base class providing:
- Default `supportsTools()`, `supportsVision()`, `supportsStreaming()`
- Default `countTokens()` (character-based estimation)
- Default `listModels()`
- Default `healthCheck()`
- Shared `generateMockResponse()` and `estimateTokenCount()`

### 5.2 Concrete Providers

| Provider | File | Type | Tools | Vision | Streaming | Max Context |
|----------|------|------|-------|--------|-----------|-------------|
| Mock | `MockProvider.ts` | MOCK | No | No | Yes | 4096 |
| OpenAI | `OpenAIProvider.ts` | OPENAI | Yes | Yes | Yes | 128K |
| Gemini | `GeminiProvider.ts` | GEMINI | Yes | Yes | Yes | 1M |
| Anthropic | `AnthropicProvider.ts` | ANTHROPIC | Yes | Yes | Yes | 200K |
| OpenRouter | `OpenRouterProvider.ts` | OPENROUTER | Yes | Yes | Yes | 128K |
| Ollama | `OllamaProvider.ts` | OLLAMA | No | No | Yes | 8K |

All providers are **shell implementations** ready for future real API integration.

## 6. Provider Registry

`AIProviderRegistry` manages provider instances:

```typescript
class AIProviderRegistry {
  register(provider: IAIProvider): void;
  unregister(type: AIProviderType, name: string): void;
  get(type: AIProviderType, name: string): IAIProvider;
  has(type: AIProviderType, name: string): boolean;
  getAll(): IAIProvider[];
}
```

## 7. Provider Factory

`AIProviderFactory` creates providers from configuration:

```typescript
class AIProviderFactory {
  static createProvider(config: AIProviderFactoryConfig): IAIProvider;
}
```

Configuration:
```typescript
interface AIProviderFactoryConfig {
  provider: AIProviderType;
  apiKey?: string;
  model?: string;
  baseURL?: string;
  organization?: string;
  isAvailable?: boolean;
}
```

## 8. Configuration

### 8.1 AIConfig

Strongly-typed AI configuration:

```typescript
interface AIConfigShape {
  provider: AIProviderType;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  stream: boolean;
  baseURL: string;
  apiKey: string;
  organization: string;
}
```

### 8.2 EnvironmentLoader

Loads secrets from environment variables:

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENROUTER_API_KEY`
- `OLLAMA_HOST`

No keys are stored in the project. `.env` is gitignored.

## 9. EventBus Integration

Providers can publish events via the existing EventBus:

- `ai.provider.completion.started`
- `ai.provider.completion.finished`
- `ai.provider.completion.failed`
- `ai.provider.stream.chunk`
- `ai.provider.stream.started`
- `ai.provider.stream.ended`
- `ai.provider.stream.failed`
- `ai.provider.registered`
- `ai.provider.unregistered`

## 10. Design Decisions

### 10.1 No Real API Calls
**Decision**: All providers are shell implementations.
**Reason**: This task builds infrastructure only. Real API integration comes later.
**Impact**: No external dependencies, no network requirements.

### 10.2 BaseProvider Pattern
**Decision**: Abstract base class with shared defaults.
**Reason**: Reduces duplication, ensures consistent interface.
**Impact**: Easy to add new providers.

### 10.3 Factory Pattern
**Decision**: Static factory method for provider creation.
**Reason**: Centralizes creation logic, decouples configuration from instantiation.
**Impact**: Easy to extend with new providers.

### 10.4 Capability Declaration
**Decision**: Providers declare capabilities via methods instead of runtime checks.
**Reason**: Type-safe, explicit, no conditional logic in system.
**Impact**: System can adapt behavior per provider.

## 11. Future Extensions

### 11.1 Real API Integration
Each provider can be enhanced with real HTTP calls:
- OpenAI: `fetch('https://api.openai.com/v1/chat/completions')`
- Gemini: `fetch('https://generativelanguage.googleapis.com/v1beta/models/...')`
- Anthropic: `fetch('https://api.anthropic.com/v1/messages')`
- OpenRouter: `fetch('https://openrouter.ai/api/v1/chat/completions')`
- Ollama: `fetch('http://localhost:11434/api/chat')`

### 11.2 Streaming
The `stream()` interface is designed for future streaming support.

### 11.3 Tool Calling
Providers declare `supportsTools()` capability. Future tasks will implement actual tool calling.

### 11.4 Vision
Providers declare `supportsVision()` capability. Future tasks will handle multimodal inputs.

## 12. Error Handling

All provider errors extend `AIProviderError`:
- `ProviderNotFoundError` - Provider not in registry
- `APIKeyMissingError` - Missing API key
- `ProviderResponseError` - Provider returned error
- `ProviderStreamError` - Streaming failed

## 13. Immutability

All provider configurations and responses are immutable where possible.

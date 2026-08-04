import type { IAIProvider, AIProviderCapabilities, AIProviderInfo } from './IAIProvider.js';
import type { AIMessage } from './AIMessage.js';
import type { AIResponse } from './AIResponse.js';
import { AIProviderType } from './AIProviderType.js';
import { MessageRole } from './AIMessage.js';
import { FinishReason } from './AIResponse.js';

/**
 * Configuration options for the MockAIProvider.
 */
export interface MockAIProviderOptions {
  /** The name of the mock provider. */
  readonly name?: string;
  /** Default response content. */
  readonly defaultResponse?: string;
  /** Whether the provider is available. */
  readonly isAvailable?: boolean;
  /** Supported models. */
  readonly models?: readonly string[];
}

/**
 * Mock AI provider for testing without network calls.
 *
 * This provider returns predictable, configurable responses and supports
 * simulated streaming for testing purposes.
 */
export class MockAIProvider implements IAIProvider {
  private readonly name: string;
  private readonly defaultResponse: string;
  private isAvailableFlag: boolean;
  private readonly models: readonly string[];

  constructor(options: MockAIProviderOptions = {}) {
    this.name = options.name ?? 'mock';
    this.defaultResponse = options.defaultResponse ?? 'This is a mock response.';
    this.isAvailableFlag = options.isAvailable ?? true;
    this.models = options.models ?? ['mock-model-v1'];
  }

  getProviderInfo(): AIProviderInfo {
    return {
      type: AIProviderType.MOCK,
      name: this.name,
      version: '1.0.0',
      isAvailable: this.isAvailableFlag,
    };
  }

  getCapabilities(): AIProviderCapabilities {
    return {
      supportsStreaming: true,
      supportsFunctionCalling: false,
      supportsVision: false,
      maxContextWindow: 4096,
      models: this.models,
    };
  }

  async complete(messages: readonly AIMessage[]): Promise<AIResponse> {
    const lastMessage = messages[messages.length - 1];
    const responseContent = this.generateResponse(lastMessage?.content ?? '');

    return {
      content: responseContent,
      finishReason: FinishReason.STOP,
      usage: {
        promptTokens: this.estimateTokenCount(messages),
        completionTokens: this.estimateTokenCount([{ role: MessageRole.ASSISTANT, content: responseContent } as AIMessage]),
        totalTokens: 0,
      },
      model: this.models[0],
    };
  }

  async *stream(messages: readonly AIMessage[]): AsyncIterable<string> {
    const response = await this.complete(messages);
    const words = response.content.split(' ');

    for (const word of words) {
      yield `${word} `;
    }
  }

  isAvailable(): boolean {
    return this.isAvailableFlag;
  }

  /**
   * Sets the availability of the provider.
   */
  setAvailable(available: boolean): void {
    this.isAvailableFlag = available;
  }

  /**
   * Generates a mock response based on the input.
   */
  private generateResponse(input: string): string {
    if (input.toLowerCase().includes('error')) {
      return 'Mock error response triggered.';
    }
    if (input.toLowerCase().includes('hello')) {
      return 'Hello! This is a mock AI response.';
    }
    return this.defaultResponse;
  }

  /**
   * Estimates the token count for a set of messages.
   */
  private estimateTokenCount(messages: readonly AIMessage[]): number {
    return messages.reduce((total, message) => total + message.content.length / 4, 0);
  }
}
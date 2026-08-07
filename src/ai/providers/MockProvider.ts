import type { AIMessage } from '../AIMessage.js';
import type { AIResponse } from '../AIResponse.js';
import { BaseProvider } from './BaseProvider.js';
import { AIProviderType } from '../AIProviderType.js';
import { MessageRole } from '../AIMessage.js';
import { FinishReason } from '../AIResponse.js';

/**
 * Configuration options for the MockProvider.
 */
export interface MockProviderOptions {
  readonly name?: string;
  readonly defaultResponse?: string;
  readonly isAvailable?: boolean;
  readonly models?: readonly string[];
  readonly supportsStreaming?: boolean;
  readonly supportsTools?: boolean;
  readonly supportsVision?: boolean;
  readonly maxContextWindow?: number;
}

/**
 * Mock AI provider for testing without network calls.
 *
 * This provider returns predictable, configurable responses and supports
 * simulated streaming for testing purposes.
 */
export class MockProvider extends BaseProvider {
  private readonly defaultResponse: string;

  constructor(options: MockProviderOptions = {}) {
    super({
      name: options.name ?? 'mock',
      isAvailable: options.isAvailable ?? true,
      models: options.models ?? ['mock-model-v1'],
      supportsStreaming: options.supportsStreaming ?? true,
      supportsTools: options.supportsTools ?? false,
      supportsVision: options.supportsVision ?? false,
      maxContextWindow: options.maxContextWindow ?? 4096,
    });
    this.defaultResponse = options.defaultResponse ?? 'This is a mock response.';
  }

  getProviderType(): AIProviderType {
    return AIProviderType.MOCK;
  }

  async complete(messages: readonly AIMessage[]): Promise<AIResponse> {
    const lastMessage = messages[messages.length - 1];
    const responseContent = this.generateMockResponse(lastMessage?.content ?? '');

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

  /**
   * Sets the availability of the provider.
   */
  setAvailable(available: boolean): void {
    this.isAvailableFlag = available;
  }

  /**
   * Generates a mock response based on the input.
   */
  protected generateMockResponse(input: string): string {
    const lowerInput = input.toLowerCase();
    if (lowerInput.includes('error')) {
      return 'Mock error response triggered.';
    }
    if (lowerInput.includes('hello')) {
      return 'Hello! This is a mock AI response.';
    }
    return this.defaultResponse;
  }
}

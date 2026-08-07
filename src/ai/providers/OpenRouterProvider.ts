import type { AIMessage } from '../AIMessage.js';
import type { AIResponse } from '../AIResponse.js';
import { BaseProvider } from './BaseProvider.js';
import { AIProviderType } from '../AIProviderType.js';
import { MessageRole } from '../AIMessage.js';
import { FinishReason } from '../AIResponse.js';

/**
 * OpenRouter provider implementation.
 *
 * This is a shell implementation ready for future real API integration.
 * Currently returns mock responses for testing and architecture validation.
 */
export class OpenRouterProvider extends BaseProvider {
  constructor(options?: {
    readonly apiKey?: string;
    readonly model?: string;
    readonly baseURL?: string;
    readonly isAvailable?: boolean;
  }) {
    super({
      name: 'openrouter',
      isAvailable: options?.isAvailable ?? true,
      models: options?.model ? [options.model] : ['openai/gpt-4o', 'anthropic/claude-3-5-sonnet', 'google/gemini-pro'],
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
      maxContextWindow: 128000,
    });
  }

  getProviderType(): AIProviderType {
    return AIProviderType.OPENROUTER;
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
}

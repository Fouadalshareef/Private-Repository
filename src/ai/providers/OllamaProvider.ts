import type { AIMessage } from '../AIMessage.js';
import type { AIResponse } from '../AIResponse.js';
import { BaseProvider } from './BaseProvider.js';
import { AIProviderType } from '../AIProviderType.js';
import { MessageRole } from '../AIMessage.js';
import { FinishReason } from '../AIResponse.js';

/**
 * Ollama provider implementation.
 *
 * This is a shell implementation ready for future real API integration.
 * Currently returns mock responses for testing and architecture validation.
 */
export class OllamaProvider extends BaseProvider {
  constructor(options?: {
    readonly host?: string;
    readonly model?: string;
    readonly isAvailable?: boolean;
  }) {
    super({
      name: 'ollama',
      isAvailable: options?.isAvailable ?? true,
      models: options?.model ? [options.model] : ['llama3.1', 'mistral', 'codellama'],
      supportsStreaming: true,
      supportsTools: false,
      supportsVision: false,
      maxContextWindow: 8192,
    });
  }

  getProviderType(): AIProviderType {
    return AIProviderType.OLLAMA;
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

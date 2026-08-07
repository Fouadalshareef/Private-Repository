import type { IAIProvider, AIProviderCapabilities, AIProviderInfo, AICompletionOptions, AIStreamOptions } from '../IAIProvider.js';
import type { AIMessage } from '../AIMessage.js';
import type { AIResponse } from '../AIResponse.js';
import { ProviderHealthStatus } from '../ProviderHealthStatus.js';
import { AIProviderType } from '../AIProviderType.js';

/**
 * Abstract base provider with default implementations.
 *
 * Provides common functionality for all AI providers including
 * token estimation, health checks, and capability declarations.
 */
export abstract class BaseProvider implements IAIProvider {
  protected readonly providerName: string;
  protected readonly providerVersion: string;
  protected isAvailableFlag: boolean;
  protected readonly models: readonly string[];
  protected readonly supportsStreamingFlag: boolean;
  protected readonly supportsToolsFlag: boolean;
  protected readonly supportsVisionFlag: boolean;
  protected readonly maxContextWindow: number;

  constructor(options: {
    readonly name: string;
    readonly version?: string;
    readonly isAvailable?: boolean;
    readonly models?: readonly string[];
    readonly supportsStreaming?: boolean;
    readonly supportsTools?: boolean;
    readonly supportsVision?: boolean;
    readonly maxContextWindow?: number;
  }) {
    this.providerName = options.name;
    this.providerVersion = options.version ?? '1.0.0';
    this.isAvailableFlag = options.isAvailable ?? true;
    this.models = options.models ?? [];
    this.supportsStreamingFlag = options.supportsStreaming ?? false;
    this.supportsToolsFlag = options.supportsTools ?? false;
    this.supportsVisionFlag = options.supportsVision ?? false;
    this.maxContextWindow = options.maxContextWindow ?? 4096;
  }

  public abstract getProviderType(): AIProviderType;

  getProviderInfo(): AIProviderInfo {
    return {
      type: this.getProviderType(),
      name: this.providerName,
      version: this.providerVersion,
      isAvailable: this.isAvailableFlag,
    };
  }

  getCapabilities(): AIProviderCapabilities {
    return {
      supportsStreaming: this.supportsStreamingFlag,
      supportsFunctionCalling: this.supportsToolsFlag,
      supportsVision: this.supportsVisionFlag,
      maxContextWindow: this.maxContextWindow,
      models: this.models,
    };
  }

  abstract complete(messages: readonly AIMessage[], options?: AICompletionOptions): Promise<AIResponse>;

  abstract stream(messages: readonly AIMessage[], options?: AIStreamOptions): AsyncIterable<string>;

  isAvailable(): boolean {
    return this.isAvailableFlag;
  }

  supportsTools(): boolean {
    return this.supportsToolsFlag;
  }

  supportsVision(): boolean {
    return this.supportsVisionFlag;
  }

  supportsStreaming(): boolean {
    return this.supportsStreamingFlag;
  }

  async countTokens(messages: readonly AIMessage[]): Promise<number> {
    return messages.reduce((total, message) => total + Math.ceil(message.content.length / 4), 0);
  }

  async listModels(): Promise<string[]> {
    return [...this.models];
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    if (!this.isAvailableFlag) {
      return ProviderHealthStatus.OFFLINE;
    }
    return ProviderHealthStatus.READY;
  }

  protected generateMockResponse(input: string): string {
    const lowerInput = input.toLowerCase();
    if (lowerInput.includes('error')) {
      return 'Mock error response triggered.';
    }
    if (lowerInput.includes('hello')) {
      return 'Hello! This is a mock AI response.';
    }
    return 'This is a mock response from the provider.';
  }

  protected estimateTokenCount(messages: readonly AIMessage[]): number {
    return messages.reduce((total, message) => total + Math.ceil(message.content.length / 4), 0);
  }
}

import type { AIMessage } from './AIMessage.js';
import type { AIResponse } from './AIResponse.js';
import type { AIProviderType } from './AIProviderType.js';

/**
 * Options for AI completion requests.
 */
export interface AICompletionOptions {
  /** The model to use for completion. */
  readonly model?: string;
  /** Maximum tokens to generate. */
  readonly maxTokens?: number;
  /** Temperature for randomness (0-2). */
  readonly temperature?: number;
  /** Top-p sampling parameter. */
  readonly topP?: number;
  /** Stop sequences. */
  readonly stop?: readonly string[];
  /** Frequency penalty. */
  readonly frequencyPenalty?: number;
  /** Presence penalty. */
  readonly presencePenalty?: number;
  /** Additional provider-specific options. */
  readonly extra?: Readonly<Record<string, unknown>>;
}

/**
 * Options for AI streaming requests.
 */
export interface AIStreamOptions extends AICompletionOptions {
  /** Callback function to handle streamed chunks. */
  readonly onChunk?: (chunk: string) => void;
  /** Callback function to handle stream completion. */
  readonly onComplete?: (response: AIResponse) => void;
  /** Callback function to handle stream errors. */
  readonly onError?: (error: Error) => void;
}

/**
 * Capabilities of an AI provider.
 */
export interface AIProviderCapabilities {
  /** Whether the provider supports streaming. */
  readonly supportsStreaming: boolean;
  /** Whether the provider supports function calling. */
  readonly supportsFunctionCalling: boolean;
  /** Whether the provider supports vision/multimodal inputs. */
  readonly supportsVision: boolean;
  /** Maximum context window size in tokens. */
  readonly maxContextWindow: number;
  /** Supported models. */
  readonly models: readonly string[];
}

/**
 * Information about an AI provider.
 */
export interface AIProviderInfo {
  /** The provider type. */
  readonly type: AIProviderType;
  /** The provider name. */
  readonly name: string;
  /** The provider version. */
  readonly version: string;
  /** Whether the provider is available. */
  readonly isAvailable: boolean;
}

/**
 * Core interface for AI provider implementations.
 *
 * This interface defines the contract for interacting with Large Language Models (LLMs).
 * Implementations should be provider-agnostic and handle the specifics of each provider.
 */
export interface IAIProvider {
  /**
   * Returns information about the provider.
   */
  getProviderInfo(): AIProviderInfo;

  /**
   * Returns the capabilities of the provider.
   */
  getCapabilities(): AIProviderCapabilities;

  /**
   * Performs a completion request with the given messages.
   *
   * @param messages The conversation messages.
   * @param options Optional completion options.
   * @returns The AI response.
   * @throws {AIProviderError} If the completion fails.
   */
  complete(messages: readonly AIMessage[], options?: AICompletionOptions): Promise<AIResponse>;

  /**
   * Performs a streaming completion request with the given messages.
   *
   * @param messages The conversation messages.
   * @param options Optional streaming options.
   * @returns An async iterator over streamed chunks.
   * @throws {AIProviderError} If the stream fails.
   */
  stream(
    messages: readonly AIMessage[],
    options?: AIStreamOptions,
  ): AsyncIterable<string>;

  /**
   * Checks if the provider is properly configured and available.
   */
  isAvailable(): boolean;
}
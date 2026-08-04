/**
 * Represents the reason why the AI provider finished generating a response.
 */
export enum FinishReason {
  /** The response completed normally. */
  STOP = 'stop',
  /** The response was truncated due to length limits. */
  LENGTH = 'length',
  /** The response was interrupted or cancelled. */
  CANCELLED = 'cancelled',
  /** The provider encountered an error. */
  ERROR = 'error',
}

/**
 * Represents token usage statistics from an AI provider response.
 */
export interface TokenUsage {
  /** Number of tokens in the prompt/input. */
  readonly promptTokens: number;
  /** Number of tokens in the completion/output. */
  readonly completionTokens: number;
  /** Total number of tokens used. */
  readonly totalTokens: number;
}

/**
 * Creates a defensive copy of token usage.
 */
export function createTokenUsage(usage: TokenUsage): TokenUsage {
  return {
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
  };
}

/**
 * Represents a structured response from an AI provider.
 */
export interface AIResponse {
  /** The generated text content. */
  readonly content: string;
  /** The reason why generation finished. */
  readonly finishReason: FinishReason;
  /** Token usage statistics. */
  readonly usage: TokenUsage;
  /** The model that generated the response. */
  readonly model: string;
  /** Optional provider-specific metadata. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Creates a defensive copy of an AI response.
 */
export function createAIResponse(response: AIResponse): AIResponse {
  return {
    content: response.content,
    finishReason: response.finishReason,
    usage: createTokenUsage(response.usage),
    model: response.model,
    ...(response.metadata !== undefined && { metadata: { ...response.metadata } }),
  };
}
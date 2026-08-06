/**
 * Base error class for context-related errors.
 */
export class ContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContextError';
  }
}

/**
 * Error thrown when a conversation session is invalid or not found.
 */
export class InvalidConversationSessionError extends ContextError {
  public readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Invalid or not found conversation session: "${sessionId}"`);
    this.name = 'InvalidConversationSessionError';
    this.sessionId = sessionId;
  }
}

/**
 * Error thrown when the context window exceeds the token limit.
 */
export class ContextWindowOverflowError extends ContextError {
  public readonly tokenCount: number;
  public readonly maxTokens: number;

  constructor(tokenCount: number, maxTokens: number) {
    super(`Context window overflow: ${tokenCount} > ${maxTokens} tokens`);
    this.name = 'ContextWindowOverflowError';
    this.tokenCount = tokenCount;
    this.maxTokens = maxTokens;
  }
}
import type { AIMessage } from '../ai/AIMessage.js';

/**
 * Strategy for managing context window size and message trimming.
 */
export interface IContextWindowStrategy {
  /**
   * Trims messages to fit within the token budget.
   */
  trim(messages: readonly AIMessage[], maxTokens: number): TrimResult;

  /**
   * Estimates the token count for a message.
   */
  estimateTokens(message: AIMessage): number;

  /**
   * Estimates the total token count for an array of messages.
   */
  estimateTotalTokens(messages: readonly AIMessage[]): number;
}

/**
 * Result of a trim operation.
 */
export interface TrimResult {
  /** The trimmed messages that fit within the budget. */
  readonly messages: readonly AIMessage[];
  /** Number of messages removed. */
  readonly removedCount: number;
  /** Whether trimming was necessary. */
  readonly trimmed: boolean;
}
import type { AIMessage } from '../ai/AIMessage.js';
import type { IContextWindowStrategy, TrimResult } from './IContextWindowStrategy.js';
import { ContextWindowOverflowError } from './ContextError.js';

/**
 * Implementation of context window management strategy.
 * Uses a sliding window approach that preserves system messages.
 */
export class ContextWindowStrategy implements IContextWindowStrategy {
  private readonly tokensPerChar: number;

  constructor(tokensPerChar: number = 0.25) {
    this.tokensPerChar = tokensPerChar;
  }

  /**
   * Trims messages to fit within the token budget.
   * Preserves system messages at the beginning.
   */
  trim(messages: readonly AIMessage[], maxTokens: number): TrimResult {
    const totalTokens = this.estimateTotalTokens(messages);
    
    if (totalTokens <= maxTokens) {
      return {
        messages: Object.freeze([...messages]),
        removedCount: 0,
        trimmed: false,
      };
    }

    // Separate system messages from other messages
    const systemMessages: AIMessage[] = [];
    const otherMessages: AIMessage[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        systemMessages.push(message);
      } else {
        otherMessages.push(message);
      }
    }

    // Calculate tokens used by system messages
    const systemTokens = this.estimateTotalTokens(systemMessages);
    
    if (systemTokens > maxTokens) {
      throw new ContextWindowOverflowError(systemTokens, maxTokens);
    }

    // Remaining budget for other messages
    const remainingBudget = maxTokens - systemTokens;
    
    // Trim other messages from the beginning (oldest first)
    const trimmedOtherMessages = this.trimFromBeginning(otherMessages, remainingBudget);
    const removedCount = otherMessages.length - trimmedOtherMessages.length;

    const resultMessages = Object.freeze([...systemMessages, ...trimmedOtherMessages]);

    return {
      messages: resultMessages,
      removedCount,
      trimmed: removedCount > 0,
    };
  }

  /**
   * Estimates the token count for a message.
   */
  estimateTokens(message: AIMessage): number {
    // Estimate based on content length + role overhead
    const contentTokens = Math.ceil(message.content.length * this.tokensPerChar);
    const roleTokens = 1; // Approximate overhead for role
    return contentTokens + roleTokens;
  }

  /**
   * Estimates the total token count for an array of messages.
   */
  estimateTotalTokens(messages: readonly AIMessage[]): number {
    return messages.reduce((total, message) => total + this.estimateTokens(message), 0);
  }

  /**
   * Trims messages from the beginning to fit within token budget.
   * Keeps the most recent messages. Optimized to avoid O(n²) unshift.
   */
  private trimFromBeginning(messages: AIMessage[], maxTokens: number): AIMessage[] {
    const result: AIMessage[] = [];
    let currentTokens = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageTokens = this.estimateTokens(message);

      if (currentTokens + messageTokens > maxTokens && result.length > 0) {
        break;
      }

      result.push(message);
      currentTokens += messageTokens;
    }

    result.reverse();
    return result;
  }
}
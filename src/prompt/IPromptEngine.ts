import type { AIMessage } from '../ai/AIMessage.js';
import type { IPromptTemplate, PromptRenderOptions, PromptRenderResult } from './IPromptTemplate.js';

/**
 * Options for composing a prompt with context.
 */
export interface PromptComposeOptions {
  /** The system prompt template or content. */
  readonly systemPrompt?: string | IPromptTemplate;
  /** The user prompt template or content. */
  readonly userPrompt: string | IPromptTemplate;
  /** Variables to substitute into templates. */
  readonly variables: Readonly<Record<string, unknown>>;
  /** Maximum token budget for the composed prompt. */
  readonly maxTokens?: number;
  /** Additional context snippets to include. */
  readonly contextSnippets?: readonly string[];
}

/**
 * Result of composing a prompt.
 */
export interface PromptComposeResult {
  /** The composed messages ready for AI provider. */
  readonly messages: readonly AIMessage[];
  /** Token usage information. */
  readonly tokenCount: number;
  /** Whether the prompt was truncated. */
  readonly truncated: boolean;
}

/**
 * Core interface for prompt engine operations.
 */
export interface IPromptEngine {
  /**
   * Renders a prompt template with variables.
   */
  render(template: string | IPromptTemplate, options: PromptRenderOptions): PromptRenderResult;

  /**
   * Composes a complete prompt with system, user, and context.
   */
  compose(options: PromptComposeOptions): PromptComposeResult;

  /**
   * Estimates the token count for a string.
   */
  estimateTokens(text: string): number;

  /**
   * Truncates text to fit within a token budget.
   */
  truncateToTokenBudget(text: string, maxTokens: number): string;
}
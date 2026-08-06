import type { IAdvisor } from './IAdvisor.js';
import type { AdvisorId } from './AdvisorIdentity.js';
import type { PromptComposeResult } from '../prompt/IPromptEngine.js';

/**
 * Runtime context for composing an advisor prompt.
 */
export interface AdvisorComposeContext {
  /** The user's current input or query. */
  readonly userInput: string;

  /** Optional conversation history messages. */
  readonly conversationHistory?: readonly { readonly role: string; readonly content: string }[];

  /** Additional context snippets to inject. */
  readonly contextSnippets?: readonly string[];

  /** Variables for template substitution. */
  readonly variables?: Readonly<Record<string, unknown>>;

  /** Maximum token budget. */
  readonly maxTokens?: number;
}

/**
 * Result of composing an advisor-specific prompt.
 */
export interface AdvisorPromptResult {
  /** The advisor that was composed for. */
  readonly advisorId: AdvisorId;

  /** The composed prompt result from the prompt engine. */
  readonly promptResult: PromptComposeResult;

  /** The effective system prompt after composition. */
  readonly systemPrompt: string;

  /** Token usage breakdown. */
  readonly tokenBreakdown: {
    readonly systemPrompt: number;
    readonly userInput: number;
    readonly contextSnippets: number;
    readonly conversationHistory: number;
    readonly total: number;
  };
}

/**
 * Contract for composing advisor-specific prompts.
 *
 * Combines an advisor's system prompt with runtime context, conversation history,
 * and allowed tools to produce a complete prompt ready for AI provider consumption.
 */
export interface IAdvisorPromptComposer {
  /**
   * Composes a prompt for a specific advisor.
   * @param advisor The advisor to compose for.
   * @param context Runtime context for composition.
   * @returns An immutable advisor prompt result.
   */
  compose(advisor: IAdvisor, context: AdvisorComposeContext): AdvisorPromptResult;

  /**
   * Validates that an advisor can be composed with the given context.
   * @param advisor The advisor to validate.
   * @param context The context to validate.
   * @returns True if composition is possible.
   */
  validate(advisor: IAdvisor, context: AdvisorComposeContext): boolean;
}
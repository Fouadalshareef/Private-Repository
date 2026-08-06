import type { IAdvisorPromptComposer, AdvisorComposeContext, AdvisorPromptResult } from './IAdvisorPromptComposer.js';
import type { IAdvisor } from './IAdvisor.js';
import type { AdvisorId } from './AdvisorIdentity.js';
import type { IPromptEngine, PromptComposeOptions, PromptComposeResult } from '../prompt/IPromptEngine.js';

/**
 * Default token budget for advisor prompts.
 */
const DEFAULT_MAX_TOKENS = 4000;

/**
 * Advisor Prompt Composer.
 *
 * Combines an advisor's system prompt with runtime context, conversation history,
 * and allowed tools to produce a complete prompt ready for AI provider consumption.
 */
export class AdvisorPromptComposer implements IAdvisorPromptComposer {
  private readonly promptEngine: IPromptEngine;

  constructor(promptEngine: IPromptEngine) {
    this.promptEngine = promptEngine;
  }

  public compose(advisor: IAdvisor, context: AdvisorComposeContext): AdvisorPromptResult {
    const systemPrompt = advisor.profile.systemPrompt;
    const maxTokens = context.maxTokens ?? DEFAULT_MAX_TOKENS;

    // Build variables from context
    const variables: Readonly<Record<string, unknown>> = {
      ...context.variables,
      advisorName: advisor.profile.name,
      advisorSpecialty: advisor.profile.specialty,
      advisorDescription: advisor.profile.description,
      userInput: context.userInput,
    };

    // Build context snippets from advisor capabilities and allowed tools
    const contextSnippets = this.buildContextSnippets(advisor, context);

    // Compose the prompt using the prompt engine
    const composeOptions: PromptComposeOptions = {
      systemPrompt,
      userPrompt: context.userInput,
      variables,
      maxTokens,
      contextSnippets: contextSnippets.length > 0 ? contextSnippets : undefined,
    };

    const promptResult = this.promptEngine.compose(composeOptions);

    // Calculate token breakdown
    const systemPromptTokens = this.promptEngine.estimateTokens(systemPrompt);
    const userInputTokens = this.promptEngine.estimateTokens(context.userInput);
    const contextSnippetsTokens = contextSnippets.reduce((sum, snippet) => sum + this.promptEngine.estimateTokens(snippet), 0);
    const conversationHistoryTokens = this.estimateConversationHistoryTokens(context.conversationHistory);

    const tokenBreakdown = {
      systemPrompt: systemPromptTokens,
      userInput: userInputTokens,
      contextSnippets: contextSnippetsTokens,
      conversationHistory: conversationHistoryTokens,
      total: promptResult.tokenCount,
    };

    return this.result(advisor.id, promptResult, systemPrompt, tokenBreakdown);
  }

  public validate(advisor: IAdvisor, context: AdvisorComposeContext): boolean {
    if (!advisor || !advisor.id || !advisor.profile || !advisor.profile.systemPrompt) {
      return false;
    }

    if (!context || !context.userInput || context.userInput.trim().length === 0) {
      return false;
    }

    return true;
  }

  private buildContextSnippets(advisor: IAdvisor, context: AdvisorComposeContext): string[] {
    const snippets: string[] = [];

    // Add advisor capabilities as context
    if (advisor.profile.capabilities.length > 0) {
      const capabilitiesList = advisor.profile.capabilities.join(', ');
      snippets.push(`Advisor capabilities: ${capabilitiesList}`);
    }

    // Add allowed tools as context
    if (advisor.profile.allowedTools.length > 0) {
      const toolsList = advisor.profile.allowedTools.join(', ');
      snippets.push(`Available tools: ${toolsList}`);
    }

    // Add user-provided context snippets
    if (context.contextSnippets && context.contextSnippets.length > 0) {
      snippets.push(...context.contextSnippets);
    }

    return snippets;
  }

  private estimateConversationHistoryTokens(history?: readonly { readonly role: string; readonly content: string }[]): number {
    if (!history || history.length === 0) {
      return 0;
    }

    return history.reduce((sum, message) => {
      return sum + this.promptEngine.estimateTokens(message.content);
    }, 0);
  }

  private result(
    advisorId: AdvisorId,
    promptResult: PromptComposeResult,
    systemPrompt: string,
    tokenBreakdown: {
      readonly systemPrompt: number;
      readonly userInput: number;
      readonly contextSnippets: number;
      readonly conversationHistory: number;
      readonly total: number;
    },
  ): AdvisorPromptResult {
    const result = {
      advisorId,
      promptResult: Object.freeze({
        ...promptResult,
        messages: Object.freeze([...promptResult.messages]),
      }),
      systemPrompt,
      tokenBreakdown: Object.freeze(tokenBreakdown),
    };
    return Object.freeze(result) as AdvisorPromptResult;
  }
}
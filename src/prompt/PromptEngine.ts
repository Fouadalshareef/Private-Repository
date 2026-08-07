import type { AIMessage } from '../ai/AIMessage.js';
import { MessageRole } from '../ai/AIMessage.js';
import type { IPromptEngine, PromptComposeOptions, PromptComposeResult } from './IPromptEngine.js';
import type { IPromptTemplate, PromptRenderOptions, PromptRenderResult } from './IPromptTemplate.js';
import { PromptTemplate } from './PromptTemplate.js';
import { PromptExceedsTokenLimitError } from './PromptError.js';

/**
 * Implementation of the prompt engine for composing and rendering prompts.
 */
export class PromptEngine implements IPromptEngine {
  private readonly templates: Map<string, IPromptTemplate> = new Map();

  /**
   * Registers a prompt template.
   */
  registerTemplate(template: IPromptTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Renders a prompt template with variables.
   */
  render(template: string | IPromptTemplate, options: PromptRenderOptions): PromptRenderResult {
    let templateString: string;
    let templateId: string | undefined;

    if (typeof template === 'string') {
      templateString = template;
    } else {
      templateString = template.template;
      templateId = template.id;
    }

    const renderer = new PromptTemplate(templateId ?? 'inline', templateString);
    return renderer.render(options);
  }

  /**
   * Composes a complete prompt with system, user, and context.
   */
  compose(options: PromptComposeOptions): PromptComposeResult {
    const messages: AIMessage[] = [];
    let totalTokens = 0;
    let truncated = false;

    // Render system prompt if provided
    if (options.systemPrompt) {
      const systemContent = this.renderPromptContent(options.systemPrompt, options.variables);
      const systemTokens = this.estimateTokens(systemContent);
      
      if (options.maxTokens && totalTokens + systemTokens > options.maxTokens) {
        throw new PromptExceedsTokenLimitError(totalTokens + systemTokens, options.maxTokens);
      }

      messages.push({
        role: MessageRole.SYSTEM,
        content: systemContent,
      });
      totalTokens += systemTokens;
    }

    // Add context snippets if provided
    if (options.contextSnippets && options.contextSnippets.length > 0) {
      for (const snippet of options.contextSnippets) {
        const snippetTokens = this.estimateTokens(snippet);
        
        if (options.maxTokens && totalTokens + snippetTokens > options.maxTokens) {
          // Truncate the snippet to fit
          const remaining = options.maxTokens - totalTokens;
          const truncatedSnippet = this.truncateToTokenBudget(snippet, remaining);
          messages.push({
            role: MessageRole.USER,
            content: `Context:\n${truncatedSnippet}`,
          });
          truncated = true;
          break;
        }

        messages.push({
          role: MessageRole.USER,
          content: `Context:\n${snippet}`,
        });
        totalTokens += snippetTokens;
      }
    }

    // Render user prompt
    const userContent = this.renderPromptContent(options.userPrompt, options.variables);
    const userTokens = this.estimateTokens(userContent);

    if (options.maxTokens && totalTokens + userTokens > options.maxTokens) {
      const remaining = options.maxTokens - totalTokens;
      const truncatedContent = this.truncateToTokenBudget(userContent, remaining);
      messages.push({
        role: MessageRole.USER,
        content: truncatedContent,
      });
      truncated = true;
    } else {
      messages.push({
        role: MessageRole.USER,
        content: userContent,
      });
      totalTokens += userTokens;
    }

    return {
      messages,
      tokenCount: totalTokens,
      truncated,
    };
  }

  /**
   * Estimates the token count for a string.
   */
  estimateTokens(text: string): number {
    // Simple token estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncates text to fit within a token budget.
   */
  truncateToTokenBudget(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) {
      return text;
    }
    return text.substring(0, maxChars - 3) + '...';
  }

  /**
   * Helper to render prompt content from string or template.
   */
  private renderPromptContent(prompt: string | IPromptTemplate, variables: Readonly<Record<string, unknown>>): string {
    if (typeof prompt === 'string') {
      return this.render(prompt, { variables, strict: true }).content;
    }

    // Check if template is registered
    const registeredTemplate = this.templates.get(prompt.id);
    const templateToUse = registeredTemplate ?? prompt;

    return this.render(templateToUse, { variables, strict: true }).content;
  }
}
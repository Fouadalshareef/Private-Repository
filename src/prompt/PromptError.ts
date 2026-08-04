/**
 * Base error class for prompt-related errors.
 */
export class PromptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromptError';
  }
}

/**
 * Error thrown when a required prompt variable is missing.
 */
export class MissingPromptVariableError extends PromptError {
  public readonly variableName: string;

  constructor(variableName: string) {
    super(`Missing required prompt variable: "${variableName}"`);
    this.name = 'MissingPromptVariableError';
    this.variableName = variableName;
  }
}

/**
 * Error thrown when a template has syntax errors.
 */
export class TemplateSyntaxError extends PromptError {
  public readonly template: string;

  constructor(template: string, message: string) {
    super(`Template syntax error: ${message}`);
    this.name = 'TemplateSyntaxError';
    this.template = template;
  }
}

/**
 * Error thrown when a prompt exceeds the token limit.
 */
export class PromptExceedsTokenLimitError extends PromptError {
  public readonly tokenCount: number;
  public readonly maxTokens: number;

  constructor(tokenCount: number, maxTokens: number) {
    super(`Prompt exceeds token limit: ${tokenCount} > ${maxTokens}`);
    this.name = 'PromptExceedsTokenLimitError';
    this.tokenCount = tokenCount;
    this.maxTokens = maxTokens;
  }
}
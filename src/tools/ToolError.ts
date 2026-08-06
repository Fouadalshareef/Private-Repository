/**
 * Base error class for tool-related errors.
 */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
  }
}

/**
 * Error thrown when a requested tool is not registered.
 */
export class ToolNotFoundError extends ToolError {
  public readonly toolName: string;

  constructor(toolName: string) {
    super(`Tool not found: "${toolName}"`);
    this.name = 'ToolNotFoundError';
    this.toolName = toolName;
  }
}

/**
 * Error thrown when tool argument validation fails.
 */
export class ToolValidationError extends ToolError {
  public readonly toolName: string;
  public readonly validationErrors: readonly string[];

  constructor(toolName: string, validationErrors: readonly string[]) {
    super(`Validation failed for tool "${toolName}": ${validationErrors.join('; ')}`);
    this.name = 'ToolValidationError';
    this.toolName = toolName;
    this.validationErrors = validationErrors;
  }
}

/**
 * Error thrown when tool execution fails unexpectedly.
 */
export class ToolExecutionError extends ToolError {
  public readonly toolName: string;
  public readonly originalError?: Error;

  constructor(toolName: string, message: string, originalError?: Error) {
    super(`Tool execution failed for "${toolName}": ${message}`);
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when tool execution exceeds timeout limit.
 */
export class ToolTimeoutError extends ToolError {
  public readonly toolName: string;
  public readonly timeoutMs: number;

  constructor(toolName: string, timeoutMs: number) {
    super(`Tool "${toolName}" execution timed out after ${timeoutMs}ms`);
    this.name = 'ToolTimeoutError';
    this.toolName = toolName;
    this.timeoutMs = timeoutMs;
  }
}

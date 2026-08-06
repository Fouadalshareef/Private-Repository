/**
 * Base error class for agent execution errors.
 */
export class AgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentError';
  }
}

/**
 * Error thrown when agent execution fails.
 */
export class AgentExecutionError extends AgentError {
  public readonly sessionId?: string;
  public readonly originalError?: Error;

  constructor(message: string, sessionId?: string, originalError?: Error) {
    super(message);
    this.name = 'AgentExecutionError';
    this.sessionId = sessionId;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when agent streaming response fails.
 */
export class AgentStreamError extends AgentError {
  public readonly sessionId?: string;
  public readonly originalError?: Error;

  constructor(message: string, sessionId?: string, originalError?: Error) {
    super(message);
    this.name = 'AgentStreamError';
    this.sessionId = sessionId;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when the agent's tool call loop exceeds the maximum allowed iterations.
 */
export class AgentToolLoopError extends AgentError {
  public readonly sessionId?: string;
  public readonly maxLoops: number;

  constructor(message: string, sessionId?: string, maxLoops: number = 0) {
    super(message);
    this.name = 'AgentToolLoopError';
    this.sessionId = sessionId;
    this.maxLoops = maxLoops;
  }
}

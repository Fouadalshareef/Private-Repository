/**
 * Base error class for all security-related errors.
 */
export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Thrown when an operation references a session that does not exist.
 */
export class SessionNotFoundError extends SecurityError {
  public readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Session "${sessionId}" was not found.`);
    this.name = 'SessionNotFoundError';
    this.sessionId = sessionId;
  }
}

/**
 * Thrown when an operation references a session that has expired.
 */
export class SessionExpiredError extends SecurityError {
  public readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Session "${sessionId}" has expired.`);
    this.name = 'SessionExpiredError';
    this.sessionId = sessionId;
  }
}

/**
 * Thrown when a tool execution attempt is denied by the authorization engine.
 */
export class UnauthorizedToolExecutionError extends SecurityError {
  public readonly toolName: string;
  public readonly sessionId: string;
  public readonly reason: string;

  constructor(toolName: string, sessionId: string, reason: string) {
    super(`Tool "${toolName}" is not authorized for session "${sessionId}": ${reason}`);
    this.name = 'UnauthorizedToolExecutionError';
    this.toolName = toolName;
    this.sessionId = sessionId;
    this.reason = reason;
  }
}

/**
 * Thrown when a tool requires interactive approval before it can be executed.
 */
export class PendingApprovalError extends SecurityError {
  public readonly toolName: string;
  public readonly sessionId: string;
  public readonly approvalToken: string;

  constructor(toolName: string, sessionId: string, approvalToken: string) {
    super(
      `Tool "${toolName}" for session "${sessionId}" requires approval. Token: "${approvalToken}"`,
    );
    this.name = 'PendingApprovalError';
    this.toolName = toolName;
    this.sessionId = sessionId;
    this.approvalToken = approvalToken;
  }
}

/**
 * Thrown when an approval token is not found or has already been resolved.
 */
export class ApprovalTokenNotFoundError extends SecurityError {
  public readonly token: string;

  constructor(token: string) {
    super(`Approval token "${token}" was not found or has already been resolved.`);
    this.name = 'ApprovalTokenNotFoundError';
    this.token = token;
  }
}

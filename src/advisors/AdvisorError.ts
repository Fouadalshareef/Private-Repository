/**
 * Error thrown when an advisor session is not found.
 */
export class InvalidAdvisorSessionError extends Error {
  constructor(sessionId: string) {
    super(`Advisor session not found: ${sessionId}`);
    this.name = 'InvalidAdvisorSessionError';
  }
}
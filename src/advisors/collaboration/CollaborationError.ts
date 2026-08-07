/**
 * Base error class for collaboration-related errors.
 */
export class CollaborationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CollaborationError';
  }
}

/**
 * Error thrown when an advisor is not found in the catalog.
 */
export class AdvisorNotFoundError extends CollaborationError {
  public readonly advisorId: string;

  constructor(advisorId: string) {
    super(`Advisor not found: ${advisorId}`);
    this.name = 'AdvisorNotFoundError';
    this.advisorId = advisorId;
  }
}

/**
 * Error thrown when a discussion is not found.
 */
export class DiscussionNotFoundError extends CollaborationError {
  public readonly discussionId: string;

  constructor(discussionId: string) {
    super(`Discussion not found: ${discussionId}`);
    this.name = 'DiscussionNotFoundError';
    this.discussionId = discussionId;
  }
}

/**
 * Error thrown when an advisor participates in a discussion multiple times.
 */
export class DuplicateParticipantError extends CollaborationError {
  public readonly advisorId: string;

  constructor(advisorId: string) {
    super(`Advisor already participates in this discussion: ${advisorId}`);
    this.name = 'DuplicateParticipantError';
    this.advisorId = advisorId;
  }
}

/**
 * Error thrown when a discussion is in an invalid state for the requested operation.
 */
export class InvalidDiscussionStateError extends CollaborationError {
  public readonly currentState: string;

  constructor(currentState: string) {
    super(`Discussion is in invalid state for this operation: ${currentState}`);
    this.name = 'InvalidDiscussionStateError';
    this.currentState = currentState;
  }
}

/**
 * Error thrown when a debate cannot be resolved.
 */
export class DebateUnresolvedError extends CollaborationError {
  public readonly debateId: string;

  constructor(debateId: string) {
    super(`Debate cannot be automatically resolved: ${debateId}`);
    this.name = 'DebateUnresolvedError';
    this.debateId = debateId;
  }
}

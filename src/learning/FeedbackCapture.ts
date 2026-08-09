import { randomUUID } from 'node:crypto';
import type { IEventBus } from '../events/IEventBus.js';
import type { IFeedbackCapture } from './interfaces.js';
import {
  FeedbackSource,
  FeedbackType,
  LearningEventType,
  LearningInputKind,
  LearningScope,
  type FeedbackCaptureInput,
  type LearningContext,
  type TextUserFeedback,
  type UserFeedback,
  type UserFeedbackReceivedEvent,
} from './types.js';

/** Thrown when an explicit-feedback input cannot be normalized safely. */
export class FeedbackValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedbackValidationError';
  }
}

/**
 * Captures explicit user feedback and publishes the normalized contract.
 * It does not interpret feedback, create learned rules, or grant authorization.
 */
export class FeedbackCapture implements IFeedbackCapture {
  private readonly eventBus: IEventBus;

  constructor(eventBus: IEventBus) {
    this.eventBus = eventBus;
  }

  public capture(input: FeedbackCaptureInput): UserFeedback {
    const content = this.requireContent(input.content);
    const scope = this.requireLearningScope(input.scope);
    const context = this.normalizeContext(input.context, scope);
    const timestamp = this.normalizeTimestamp(input.timestamp);
    const feedback = this.createFeedback(input, content, scope, context, timestamp);

    const event: UserFeedbackReceivedEvent = {
      type: LearningEventType.UserFeedbackReceived,
      timestamp: feedback.timestamp,
      payload: feedback,
    };
    this.eventBus.publish(event);

    return feedback;
  }

  private createFeedback(
    input: FeedbackCaptureInput,
    content: string,
    scope: LearningScope,
    context: LearningContext,
    timestamp: number,
  ): UserFeedback {
    const kind: LearningInputKind.ExplicitUserFeedback = LearningInputKind.ExplicitUserFeedback;
    const base = {
      feedbackId: `feedback-${randomUUID()}`,
      content,
      source: this.requireFeedbackSource(input.source),
      kind,
      scope,
      context,
      timestamp,
    };

    if (input.type === FeedbackType.Rating) {
      if (typeof input.rating !== 'number' || !Number.isFinite(input.rating)) {
        throw new FeedbackValidationError('Rating feedback requires a finite numeric rating.');
      }
      return Object.freeze({ ...base, type: FeedbackType.Rating, rating: input.rating });
    }

    if (input.rating !== undefined) {
      throw new FeedbackValidationError('Only rating feedback may include a rating.');
    }

    const type = this.requireTextFeedbackType(input.type);
    const feedback: TextUserFeedback = Object.freeze({ ...base, type });
    return feedback;
  }

  private normalizeContext(context: LearningContext, scope: LearningScope): LearningContext {
    const sessionId = this.normalizeOptionalIdentifier(context.sessionId, 'sessionId');
    const conversationId = this.normalizeOptionalIdentifier(context.conversationId, 'conversationId');
    const projectId = this.normalizeOptionalIdentifier(context.projectId, 'projectId');

    switch (scope) {
      case LearningScope.Session:
        if (!sessionId) {
          throw new FeedbackValidationError('Session-scoped feedback requires a sessionId.');
        }
        return Object.freeze({ sessionId, conversationId, projectId });
      case LearningScope.Conversation:
        if (!conversationId) {
          throw new FeedbackValidationError('Conversation-scoped feedback requires a conversationId.');
        }
        return Object.freeze({ sessionId, conversationId, projectId });
      case LearningScope.Project:
        if (!projectId) {
          throw new FeedbackValidationError('Project-scoped feedback requires a projectId.');
        }
        return Object.freeze({ sessionId, conversationId, projectId });
      default:
        throw new FeedbackValidationError('Feedback scope is invalid.');
    }
  }

  private requireLearningScope(scope: LearningScope): LearningScope {
    switch (scope) {
      case LearningScope.Session:
      case LearningScope.Conversation:
      case LearningScope.Project:
        return scope;
      default:
        throw new FeedbackValidationError('Feedback scope is invalid.');
    }
  }

  private requireContent(content: string): string {
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new FeedbackValidationError('Feedback content must not be empty.');
    }
    return content.trim();
  }

  private normalizeTimestamp(timestamp: number | undefined): number {
    const value = timestamp ?? Date.now();
    if (!Number.isFinite(value) || value < 0) {
      throw new FeedbackValidationError('Feedback timestamp must be a non-negative finite number.');
    }
    return value;
  }

  private normalizeOptionalIdentifier(identifier: string | undefined, field: string): string | undefined {
    if (identifier === undefined) {
      return undefined;
    }
    if (typeof identifier !== 'string' || identifier.trim().length === 0) {
      throw new FeedbackValidationError(`Feedback ${field} must be a non-empty string.`);
    }
    return identifier.trim();
  }

  private requireFeedbackSource(source: FeedbackSource): FeedbackSource {
    switch (source) {
      case FeedbackSource.User:
      case FeedbackSource.Conversation:
      case FeedbackSource.Tui:
      case FeedbackSource.Cli:
        return source;
      default:
        throw new FeedbackValidationError('Feedback source is invalid.');
    }
  }

  private requireTextFeedbackType(type: FeedbackType): TextUserFeedback['type'] {
    switch (type) {
      case FeedbackType.Instruction:
      case FeedbackType.Correction:
      case FeedbackType.Rejection:
      case FeedbackType.Approval:
      case FeedbackType.Preference:
        return type;
      default:
        throw new FeedbackValidationError('Feedback type is invalid.');
    }
  }
}

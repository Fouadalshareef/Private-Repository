import { randomUUID } from 'node:crypto';
import type { IEventBus } from '../events/IEventBus.js';
import type { IFeedbackProcessor } from './interfaces.js';
import {
  FeedbackType,
  LearningEventType,
  LearningInputKind,
  LearningScope,
  type LearningContext,
  type LearningSignal,
  type LearningSignalCreatedEvent,
  type SystemObservation,
  type UserFeedback,
} from './types.js';

/** Thrown when an explicit feedback contract is invalid for semantic processing. */
export class FeedbackProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedbackProcessingError';
  }
}

/**
 * Conservative deterministic semantic processing for explicit user feedback.
 * It produces only transient LearningSignals: no learned rules, persistence,
 * authorization, prompt injection, or planning behaviour is performed here.
 */
export class SemanticFeedbackProcessor implements IFeedbackProcessor {
  private readonly eventBus: IEventBus | undefined;

  constructor(eventBus?: IEventBus) {
    this.eventBus = eventBus;
  }

  public async process(feedback: UserFeedback | SystemObservation): Promise<LearningSignal | undefined> {
    if (feedback.kind !== LearningInputKind.ExplicitUserFeedback) {
      return undefined;
    }

    const content = this.normalizeContent(feedback.content);
    this.validateScope(feedback.scope, feedback.context);

    if (!this.isCandidateFeedbackType(feedback.type)) {
      return undefined;
    }

    const signal: LearningSignal = Object.freeze({
      signalId: `signal-${randomUUID()}`,
      sourceFeedbackId: feedback.feedbackId,
      feedbackType: feedback.type,
      candidate: content,
      scope: feedback.scope,
      context: this.copyContext(feedback.context),
      createdAt: Date.now(),
    });

    const event: LearningSignalCreatedEvent = {
      type: LearningEventType.LearningSignalCreated,
      timestamp: signal.createdAt,
      payload: signal,
    };
    this.eventBus?.publish(event);

    return signal;
  }

  private isCandidateFeedbackType(type: FeedbackType): boolean {
    switch (type) {
      case FeedbackType.Instruction:
      case FeedbackType.Correction:
      case FeedbackType.Preference:
      case FeedbackType.Rejection:
        return true;
      case FeedbackType.Approval:
      case FeedbackType.Rating:
        return false;
      default:
        throw new FeedbackProcessingError('Feedback type is invalid.');
    }
  }

  private normalizeContent(content: string): string {
    if (typeof content !== 'string') {
      throw new FeedbackProcessingError('Feedback content must be a string.');
    }
    const normalized = content.trim().replace(/\s+/g, ' ');
    if (normalized.length === 0) {
      throw new FeedbackProcessingError('Feedback content must not be empty.');
    }
    return normalized;
  }

  private validateScope(scope: LearningScope, context: LearningContext): void {
    switch (scope) {
      case LearningScope.Session:
        if (!context.sessionId) {
          throw new FeedbackProcessingError('Session-scoped feedback requires a sessionId.');
        }
        return;
      case LearningScope.Conversation:
        if (!context.conversationId) {
          throw new FeedbackProcessingError('Conversation-scoped feedback requires a conversationId.');
        }
        return;
      case LearningScope.Project:
        if (!context.projectId) {
          throw new FeedbackProcessingError('Project-scoped feedback requires a projectId.');
        }
        return;
      default:
        throw new FeedbackProcessingError('Feedback scope is invalid.');
    }
  }

  private copyContext(context: LearningContext): LearningContext {
    return Object.freeze({ ...context });
  }
}

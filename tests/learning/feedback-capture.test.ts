import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/events/EventBus.js';
import {
  FeedbackCapture,
  FeedbackSource,
  FeedbackType,
  FeedbackValidationError,
  LearningEventType,
  LearningInputKind,
  LearningScope,
} from '../../src/learning/index.js';

function createCapture() {
  const eventBus = new EventBus();
  return { capture: new FeedbackCapture(eventBus), eventBus };
}

describe('FeedbackCapture', () => {
  it.each([
    [FeedbackType.Instruction, 'Use TypeScript only.'],
    [FeedbackType.Correction, 'Do not use library X.'],
    [FeedbackType.Rejection, 'I do not want this plan.'],
    [FeedbackType.Approval, 'This approach is excellent.'],
    [FeedbackType.Preference, 'I prefer this style.'],
  ])('captures and normalizes %s feedback', (type, content) => {
    const { capture } = createCapture();

    const feedback = capture.capture({
      content,
      source: FeedbackSource.User,
      type,
      scope: LearningScope.Project,
      context: { projectId: 'project-1' },
      timestamp: 100,
    });

    expect(feedback.type).toBe(type);
    expect(feedback.content).toBe(content);
    expect(feedback.kind).toBe(LearningInputKind.ExplicitUserFeedback);
    expect(feedback.feedbackId).toMatch(/^feedback-/);
    expect(Object.isFrozen(feedback)).toBe(true);
  });

  it('publishes normalized feedback through EventBus', () => {
    const { capture, eventBus } = createCapture();
    const handler = vi.fn();
    eventBus.subscribe(LearningEventType.UserFeedbackReceived, handler);

    const feedback = capture.capture({
      content: '  Use strict mode.  ',
      source: FeedbackSource.Cli,
      type: FeedbackType.Instruction,
      scope: LearningScope.Session,
      context: { sessionId: ' session-1 ' },
      timestamp: 101,
    });

    expect(feedback.content).toBe('Use strict mode.');
    expect(feedback.context.sessionId).toBe('session-1');
    expect(handler).toHaveBeenCalledWith({
      type: LearningEventType.UserFeedbackReceived,
      timestamp: 101,
      payload: feedback,
    });
  });

  it('supports validated rating feedback', () => {
    const { capture } = createCapture();

    const feedback = capture.capture({
      content: 'Excellent result.',
      source: FeedbackSource.Tui,
      type: FeedbackType.Rating,
      rating: 5,
      scope: LearningScope.Conversation,
      context: { conversationId: 'conversation-1' },
      timestamp: 102,
    });

    expect(feedback.type).toBe(FeedbackType.Rating);
    if (feedback.type === FeedbackType.Rating) {
      expect(feedback.rating).toBe(5);
    }
  });

  it('rejects empty content and invalid contextual boundaries', () => {
    const { capture } = createCapture();

    expect(() => capture.capture({
      content: '   ',
      source: FeedbackSource.User,
      type: FeedbackType.Correction,
      scope: LearningScope.Project,
      context: { projectId: 'project-1' },
    })).toThrow(FeedbackValidationError);

    expect(() => capture.capture({
      content: 'Use strict mode.',
      source: FeedbackSource.User,
      type: FeedbackType.Instruction,
      scope: LearningScope.Project,
      context: { projectId: '' },
    })).toThrow(FeedbackValidationError);
  });

  it('rejects invalid type-related and identifier values without learning', () => {
    const { capture } = createCapture();

    expect(() => capture.capture({
      content: 'Great result.',
      source: FeedbackSource.User,
      type: FeedbackType.Approval,
      rating: 5,
      scope: LearningScope.Session,
      context: { sessionId: 'session-1' },
    })).toThrow(FeedbackValidationError);

    expect(() => capture.capture({
      content: 'Rate this.',
      source: FeedbackSource.User,
      type: FeedbackType.Rating,
      scope: LearningScope.Session,
      context: { sessionId: 'session-1' },
    })).toThrow(FeedbackValidationError);
  });

  it('rejects malformed runtime input, invalid types, and invalid scopes', () => {
    const { capture } = createCapture();

    expect(() => Reflect.apply(capture.capture, capture, [{}])).toThrow(FeedbackValidationError);
    expect(() => Reflect.apply(capture.capture, capture, [{
      content: 'Invalid type.',
      source: FeedbackSource.User,
      type: 'not-a-feedback-type',
      scope: LearningScope.Session,
      context: { sessionId: 'session-1' },
    }])).toThrow(FeedbackValidationError);
    expect(() => Reflect.apply(capture.capture, capture, [{
      content: 'Invalid scope.',
      source: FeedbackSource.User,
      type: FeedbackType.Instruction,
      scope: 'not-a-learning-scope',
      context: { sessionId: 'session-1' },
    }])).toThrow(FeedbackValidationError);
  });
});

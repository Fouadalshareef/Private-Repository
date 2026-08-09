import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/events/EventBus.js';
import {
  FeedbackProcessingError,
  FeedbackSource,
  FeedbackType,
  LearningEventType,
  LearningInputKind,
  LearningScope,
  SemanticFeedbackProcessor,
  type SystemObservation,
  type UserFeedback,
} from '../../src/learning/index.js';

function createFeedback(
  type: UserFeedback['type'],
  content: string,
  scope: LearningScope = LearningScope.Project,
): UserFeedback {
  const context = scope === LearningScope.Session
    ? { sessionId: 'session-1' }
    : scope === LearningScope.Conversation
      ? { conversationId: 'conversation-1' }
      : { projectId: 'project-1' };

  if (type === FeedbackType.Rating) {
    return {
      feedbackId: 'feedback-rating',
      content,
      source: FeedbackSource.User,
      kind: LearningInputKind.ExplicitUserFeedback,
      type,
      rating: 5,
      scope,
      context,
      timestamp: 100,
    };
  }

  return {
    feedbackId: `feedback-${type}`,
    content,
    source: FeedbackSource.User,
    kind: LearningInputKind.ExplicitUserFeedback,
    type,
    scope,
    context,
    timestamp: 100,
  };
}

describe('SemanticFeedbackProcessor', () => {
  it('creates a linked, scoped signal for an instruction', async () => {
    const processor = new SemanticFeedbackProcessor();
    const feedback = createFeedback(FeedbackType.Instruction, 'Use TypeScript strict mode.');

    const signal = await processor.process(feedback);

    expect(signal).toMatchObject({
      sourceFeedbackId: feedback.feedbackId,
      feedbackType: FeedbackType.Instruction,
      candidate: 'Use TypeScript strict mode.',
      scope: LearningScope.Project,
      context: { projectId: 'project-1' },
    });
    expect(signal?.signalId).toMatch(/^signal-/);
  });

  it('preserves correction and preference meaning without adding claims', async () => {
    const processor = new SemanticFeedbackProcessor();
    const correction = await processor.process(createFeedback(FeedbackType.Correction, 'Do not use library X.'));
    const preference = await processor.process(createFeedback(FeedbackType.Preference, 'I prefer this style.'));

    expect(correction?.candidate).toBe('Do not use library X.');
    expect(preference?.candidate).toBe('I prefer this style.');
    expect(correction?.candidate).not.toContain('all external libraries');
  });

  it('keeps rejection scoped and does not generalize it', async () => {
    const processor = new SemanticFeedbackProcessor();
    const signal = await processor.process(
      createFeedback(FeedbackType.Rejection, 'I do not want this plan.', LearningScope.Session),
    );

    expect(signal?.scope).toBe(LearningScope.Session);
    expect(signal?.context).toEqual({ sessionId: 'session-1' });
    expect(signal?.candidate).toBe('I do not want this plan.');
    expect(signal?.candidate).not.toContain('Never use');
  });

  it.each([FeedbackType.Approval, FeedbackType.Rating])(
    'does not create a signal from %s alone',
    async (type) => {
      const processor = new SemanticFeedbackProcessor();

      await expect(processor.process(createFeedback(type, 'Excellent result.'))).resolves.toBeUndefined();
    },
  );

  it.each([LearningScope.Session, LearningScope.Conversation, LearningScope.Project])(
    'preserves the %s scope',
    async (scope) => {
      const processor = new SemanticFeedbackProcessor();
      const feedback = createFeedback(FeedbackType.Instruction, 'Keep this boundary.', scope);

      const signal = await processor.process(feedback);

      expect(signal?.scope).toBe(scope);
      expect(signal?.context).toEqual(feedback.context);
    },
  );

  it('ignores a system observation instead of learning from it', async () => {
    const processor = new SemanticFeedbackProcessor();
    const observation: SystemObservation = {
      observationId: 'observation-1',
      kind: LearningInputKind.SystemObservation,
      category: 'tool_execution',
      context: { sessionId: 'session-1' },
      timestamp: 100,
    };

    await expect(processor.process(observation)).resolves.toBeUndefined();
  });

  it('rejects empty feedback and emits a signal event only for candidates', async () => {
    const eventBus = new EventBus();
    const handler = vi.fn();
    eventBus.subscribe(LearningEventType.LearningSignalCreated, handler);
    const processor = new SemanticFeedbackProcessor(eventBus);

    await expect(processor.process(createFeedback(FeedbackType.Instruction, '   ')))
      .rejects.toBeInstanceOf(FeedbackProcessingError);
    expect(handler).not.toHaveBeenCalled();

    const feedback = createFeedback(FeedbackType.Instruction, 'Use strict mode.');
    const signal = await processor.process(feedback);
    expect(handler).toHaveBeenCalledWith({
      type: LearningEventType.LearningSignalCreated,
      timestamp: signal?.createdAt,
      payload: signal,
    });
  });
});

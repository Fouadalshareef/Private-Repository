import { describe, expect, it } from 'vitest';
import {
  FeedbackSource,
  FeedbackType,
  LearningEventType,
  LearningInputKind,
  LearningResultStatus,
  LearningScope,
  type LearnedRule,
  type LearningResult,
  type SystemObservation,
  type UserFeedback,
  type UserFeedbackReceivedEvent,
} from '../../src/learning/index.js';

describe('Learning contracts', () => {
  it('represents explicit user feedback with its contextual boundary', () => {
    const feedback: UserFeedback = {
      feedbackId: 'feedback-1',
      content: 'Use TypeScript strict.',
      source: FeedbackSource.Cli,
      kind: LearningInputKind.ExplicitUserFeedback,
      type: FeedbackType.Instruction,
      context: { sessionId: 'session-1', projectId: 'project-1' },
      timestamp: 1_725_000_000_000,
    };

    expect(feedback.type).toBe(FeedbackType.Instruction);
    expect(feedback.context.projectId).toBe('project-1');
  });

  it('distinguishes feedback categories and rating feedback', () => {
    const rating: UserFeedback = {
      feedbackId: 'feedback-2',
      content: 'I prefer this style.',
      source: FeedbackSource.Tui,
      kind: LearningInputKind.ExplicitUserFeedback,
      type: FeedbackType.Rating,
      rating: 5,
      context: { conversationId: 'conversation-1' },
      timestamp: 1_725_000_000_001,
    };

    expect(rating.type).toBe(FeedbackType.Rating);
    expect(rating.rating).toBe(5);
  });

  it('links an abstract learned rule to feedback with scope and confidence', () => {
    const rule: LearnedRule = {
      ruleId: 'rule-1',
      rule: 'Use TypeScript strict in project-1.',
      scope: LearningScope.Project,
      context: { projectId: 'project-1' },
      sourceFeedbackId: 'feedback-1',
      createdAt: 1_725_000_000_002,
      confidence: 0.9,
    };

    expect(rule.scope).toBe(LearningScope.Project);
    expect(rule.confidence).toBe(0.9);
    expect(Object.keys(rule)).not.toContain('authorization');
  });

  it('keeps system observations distinct from learnable user feedback', () => {
    const observation: SystemObservation = {
      observationId: 'observation-1',
      kind: LearningInputKind.SystemObservation,
      category: 'tool_execution',
      context: { sessionId: 'session-1' },
      timestamp: 1_725_000_000_003,
    };

    expect(observation.kind).toBe(LearningInputKind.SystemObservation);
    expect(observation.kind).not.toBe(LearningInputKind.ExplicitUserFeedback);
  });

  it('models reserved learning events using the existing Event contract shape', () => {
    const event: UserFeedbackReceivedEvent = {
      type: LearningEventType.UserFeedbackReceived,
      timestamp: 1_725_000_000_004,
      payload: {
        feedbackId: 'feedback-3',
        content: 'Do not use library X.',
        source: FeedbackSource.Conversation,
        kind: LearningInputKind.ExplicitUserFeedback,
        type: FeedbackType.Rejection,
        context: { projectId: 'project-1' },
        timestamp: 1_725_000_000_004,
      },
    };

    expect(event.type).toBe('user.feedback.received');
  });

  it('models a future learning result without implementing a learning engine', () => {
    const result: LearningResult = {
      status: LearningResultStatus.Ignored,
      feedbackId: 'feedback-4',
      processedAt: 1_725_000_000_005,
      reason: 'No durable preference was identified.',
    };

    expect(result.status).toBe(LearningResultStatus.Ignored);
  });
});

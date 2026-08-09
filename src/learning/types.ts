import type { Event } from '../events/EventTypes.js';

/** Identifies the channel that supplied explicit user feedback. */
export enum FeedbackSource {
  User = 'user',
  Conversation = 'conversation',
  Tui = 'tui',
  Cli = 'cli',
}

/** Explicit feedback categories supported by the V1 learning contracts. */
export enum FeedbackType {
  Instruction = 'instruction',
  Correction = 'correction',
  Rejection = 'rejection',
  Approval = 'approval',
  Rating = 'rating',
  Preference = 'preference',
}

/** Deliberately distinguishes learnable user feedback from system observations. */
export enum LearningInputKind {
  ExplicitUserFeedback = 'explicit_user_feedback',
  SystemObservation = 'system_observation',
}

/** The supported ownership boundaries for a learned rule in V1. */
export enum LearningScope {
  Session = 'session',
  Conversation = 'conversation',
  Project = 'project',
}

/**
 * Context that links feedback, signals, and rules to their source boundary.
 * At least one session, conversation, or project identifier is always present.
 */
export type LearningContext =
  | {
      readonly sessionId: string;
      readonly conversationId?: string;
      readonly projectId?: string;
    }
  | {
      readonly sessionId?: string;
      readonly conversationId: string;
      readonly projectId?: string;
    }
  | {
      readonly sessionId?: string;
      readonly conversationId?: string;
      readonly projectId: string;
    };

interface UserFeedbackBase {
  readonly feedbackId: string;
  readonly content: string;
  readonly source: FeedbackSource;
  readonly kind: LearningInputKind.ExplicitUserFeedback;
  readonly type: FeedbackType;
  readonly context: LearningContext;
  readonly timestamp: number;
}

/** An explicit rating is represented independently from free-form feedback content. */
export interface RatingUserFeedback extends UserFeedbackBase {
  readonly type: FeedbackType.Rating;
  /** Producer-provided rating value. Validation and scoring are deferred. */
  readonly rating: number;
}

/** Explicit non-rating feedback supplied by a user. */
export interface TextUserFeedback extends UserFeedbackBase {
  readonly type:
    | FeedbackType.Instruction
    | FeedbackType.Correction
    | FeedbackType.Rejection
    | FeedbackType.Approval
    | FeedbackType.Preference;
  readonly rating?: never;
}

/**
 * User-provided feedback eligible for later learning evaluation.
 * This contract contains no credentials or authorization data.
 */
export type UserFeedback = RatingUserFeedback | TextUserFeedback;

/** Operational information that must not be treated as UserFeedback in V1. */
export interface SystemObservation {
  readonly observationId: string;
  readonly kind: LearningInputKind.SystemObservation;
  readonly category: 'agent_execution' | 'tool_execution' | 'planner_execution' | 'token_usage' | 'latency';
  readonly context: LearningContext;
  readonly timestamp: number;
}

/** A possible learning candidate produced from explicit feedback before persistence. */
export interface LearningSignal {
  readonly signalId: string;
  readonly sourceFeedbackId: string;
  readonly feedbackType: FeedbackType;
  readonly candidate: string;
  readonly scope: LearningScope;
  readonly context: LearningContext;
  readonly createdAt: number;
}

/**
 * Abstract reusable knowledge derived from explicit feedback.
 * Learned preferences MUST NOT grant tool authorization, permissions, or security policy.
 */
export interface LearnedRule {
  readonly ruleId: string;
  readonly rule: string;
  readonly scope: LearningScope;
  readonly context: LearningContext;
  readonly sourceFeedbackId: string;
  readonly createdAt: number;
  /** Confidence is expected to be within 0..1; its calculation is deferred. */
  readonly confidence: number;
}

/** Outcome categories for a future learning operation. */
export enum LearningResultStatus {
  Accepted = 'accepted',
  Rejected = 'rejected',
  Ignored = 'ignored',
}

/** Result of processing feedback or a signal without prescribing an implementation. */
export interface LearningResult {
  readonly status: LearningResultStatus;
  readonly feedbackId: string;
  readonly signalId?: string;
  readonly learnedRule?: LearnedRule;
  readonly processedAt: number;
  readonly reason?: string;
}

/** Event names reserved for learning integration with the existing EventBus. */
export enum LearningEventType {
  UserFeedbackReceived = 'user.feedback.received',
  LearningSignalCreated = 'learning.signal.created',
  LearningPreferenceUpdated = 'learning.preference.updated',
}

export type UserFeedbackReceivedEvent = Event<UserFeedback> & {
  readonly type: LearningEventType.UserFeedbackReceived;
};

export type LearningSignalCreatedEvent = Event<LearningSignal> & {
  readonly type: LearningEventType.LearningSignalCreated;
};

export type LearningPreferenceUpdatedEvent = Event<LearnedRule> & {
  readonly type: LearningEventType.LearningPreferenceUpdated;
};

/** Learning-domain events compatible with the existing generic EventBus contract. */
export type LearningEvent =
  | UserFeedbackReceivedEvent
  | LearningSignalCreatedEvent
  | LearningPreferenceUpdatedEvent;

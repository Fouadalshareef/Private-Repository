import type {
  FeedbackCaptureInput,
  LearnedRule,
  LearningContext,
  LearningEvidence,
  LearningResult,
  LearningScope,
  LearningSignal,
  UserFeedback,
} from './types.js';

/** Captures, validates, normalizes, and publishes explicit user feedback only. */
export interface IFeedbackCapture {
  capture(input: FeedbackCaptureInput): UserFeedback;
}

/** Defines future feedback normalization without prescribing LLM extraction. */
export interface IFeedbackProcessor {
  process(feedback: UserFeedback): Promise<LearningSignal | undefined>;
}

/** Defines the small future-facing boundary for learning orchestration. */
export interface ILearningSystem {
  processFeedback(feedback: UserFeedback): Promise<LearningResult>;
  processSignal(signal: LearningSignal): Promise<LearningResult>;
}

/** Separates learned-knowledge storage from future learning logic. */
export interface ILearnedKnowledgeStore {
  store(rule: LearnedRule): Promise<LearnedRule>;
  getRules(scope: LearningScope, context: LearningContext): Promise<readonly LearnedRule[]>;
  update(rule: LearnedRule): Promise<LearnedRule>;
  remove(ruleId: string): Promise<boolean>;
}

/**
 * Transient, scoped storage for LearningEvidence items.
 * Evidence is process-lifetime only and is not persisted.
 */
export interface IEvidenceStore {
  /** Store a single evidence item. Returns the stored evidence. */
  store(evidence: LearningEvidence): Promise<LearningEvidence>;
  /** Retrieve all stored evidence items. */
  getAll(): Promise<readonly LearningEvidence[]>;
  /** Retrieve evidence matching a scope and context. */
  getEvidence(scope: LearningScope, context: LearningContext): Promise<readonly LearningEvidence[]>;
  /** Remove all evidence matching a scope and context. */
  clear(scope: LearningScope, context: LearningContext): Promise<void>;
}

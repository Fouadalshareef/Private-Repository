import type {
  LearnedRule,
  LearningContext,
  LearningResult,
  LearningScope,
  LearningSignal,
  UserFeedback,
} from './types.js';

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

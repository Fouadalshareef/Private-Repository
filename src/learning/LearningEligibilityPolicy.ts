import { FeedbackType } from './types.js';

/** Thrown when the eligibility policy is used with an invalid input. */
export class EligibilityPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EligibilityPolicyError';
  }
}

/**
 * Deterministic eligibility policy (ARCH-0046-02 + ARCH-0046-03).
 *
 * It answers only one question: may this feedback type produce a LearnedRule?
 *
 *   Instruction -> eligible (single explicit signal, scoped)
 *   Correction  -> eligible (single explicit signal, scoped)
 *   Preference  -> eligible (single explicit signal, scoped)
 *   Rejection   -> not eligible (scoped signal only; never generalised)
 *   Approval    -> not eligible
 *   Rating      -> not eligible
 *
 * Eligibility is deliberately **separated** from confidence. This policy does
 * NOT compute any numeric confidence, baseline, threshold, or bonus. No
 * numerical confidence policy is invented or implemented here; a numeric
 * confidence value is currently undetermined/deferred (ARCH-0046-03).
 *
 * The only deterministic normalisation supplied is exact candidate-text
 * normalisation (trim + collapse whitespace) used for conservative exact-match
 * repetition detection within the same scope. It does not use semantic
 * similarity, embeddings, or LLM.
 *
 * This policy NEVER grants authorization, permission, tool access, or security
 * policy. It does not touch the Planner, Agent, Prompt, or Security layers.
 */
export class LearningEligibilityPolicy {
  /**
   * Returns whether a feedback type is eligible to produce a LearnedRule.
   * Only Instruction, Correction, and Preference are eligible in V1.
   */
  public isEligible(type: FeedbackType): boolean {
    switch (type) {
      case FeedbackType.Instruction:
      case FeedbackType.Correction:
      case FeedbackType.Preference:
        return true;
      case FeedbackType.Rejection:
      case FeedbackType.Approval:
      case FeedbackType.Rating:
        return false;
      default:
        throw new EligibilityPolicyError('Feedback type is invalid.');
    }
  }

  /**
   * Normalizes candidate text deterministically (trim + collapse whitespace).
   * Used for conservative exact-match repetition detection. It does not
   * compute confidence or any numeric value.
   */
  public normalize(candidate: string): string {
    if (typeof candidate !== 'string') {
      throw new EligibilityPolicyError('Candidate must be a string.');
    }
    return candidate.trim().replace(/\s+/g, ' ');
  }
}

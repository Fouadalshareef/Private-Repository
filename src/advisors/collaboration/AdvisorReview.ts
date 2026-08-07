import type { AdvisorId } from '../AdvisorIdentity.js';

/**
 * Approval status of a review.
 */
export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  APPROVED_WITH_CONDITIONS = 'approved_with_conditions',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

/**
 * Immutable review result from one advisor on another's work.
 */
export interface AdvisorReview {
  readonly reviewId: string;
  readonly reviewer: AdvisorId;
  readonly target: AdvisorId;
  readonly topic: string;
  readonly summary: string;
  readonly issues: readonly string[];
  readonly recommendations: readonly string[];
  readonly approvalStatus: ApprovalStatus;
  readonly createdAt: number;
}

/**
 * Creates a frozen AdvisorReview instance.
 */
export function createAdvisorReview(review: AdvisorReview): AdvisorReview {
  return Object.freeze({
    ...review,
    reviewer: review.reviewer,
    target: review.target,
    issues: Object.freeze([...review.issues]),
    recommendations: Object.freeze([...review.recommendations]),
  });
}

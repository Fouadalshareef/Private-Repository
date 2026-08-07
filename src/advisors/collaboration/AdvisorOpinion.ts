import type { AdvisorId } from '../AdvisorIdentity.js';

/**
 * Status of an opinion request.
 */
export enum OpinionStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  CANCELLED = 'cancelled',
}

/**
 * Immutable opinion from an advisor about a topic.
 */
export interface AdvisorOpinion {
  readonly opinionId: string;
  readonly advisorId: AdvisorId;
  readonly topic: string;
  readonly summary: string;
  readonly details: readonly string[];
  readonly confidence: number;
  readonly recommendations: readonly string[];
  readonly createdAt: number;
  readonly status: OpinionStatus;
}

/**
 * Creates a frozen AdvisorOpinion instance.
 */
export function createAdvisorOpinion(opinion: AdvisorOpinion): AdvisorOpinion {
  return Object.freeze({
    ...opinion,
    advisorId: opinion.advisorId,
    details: Object.freeze([...opinion.details]),
    recommendations: Object.freeze([...opinion.recommendations]),
  });
}

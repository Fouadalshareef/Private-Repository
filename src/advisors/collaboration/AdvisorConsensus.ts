import type { AdvisorId } from '../AdvisorIdentity.js';

/**
 * Immutable consensus result from multiple advisors.
 */
export interface AdvisorConsensus {
  readonly consensusId: string;
  readonly discussionId: string;
  readonly topic: string;
  readonly agreedOpinions: readonly { advisorId: AdvisorId; summary: string }[];
  readonly disagreedOpinions: readonly { advisorId: AdvisorId; summary: string }[];
  readonly decision: string;
  readonly reason: string;
  readonly confidence: number;
  readonly createdAt: number;
}

/**
 * Creates a frozen AdvisorConsensus instance.
 */
export function createAdvisorConsensus(consensus: AdvisorConsensus): AdvisorConsensus {
  return Object.freeze({
    ...consensus,
    agreedOpinions: Object.freeze([...consensus.agreedOpinions]),
    disagreedOpinions: Object.freeze([...consensus.disagreedOpinions]),
  });
}

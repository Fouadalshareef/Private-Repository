import type { AdvisorId } from '../AdvisorIdentity.js';
import type { AdvisorOpinion } from './AdvisorOpinion.js';
import type { AdvisorReview } from './AdvisorReview.js';
import type { AdvisorConsensus } from './AdvisorConsensus.js';
import type { AdvisorDebate } from './AdvisorDebate.js';
import { createAdvisorConsensus } from './AdvisorConsensus.js';
import { createAdvisorDebate } from './AdvisorDebate.js';

/**
 * Status of a discussion.
 */
export enum DiscussionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * A single message in a discussion.
 */
export interface DiscussionMessage {
  readonly messageId: string;
  readonly advisorId: AdvisorId;
  readonly content: string;
  readonly timestamp: number;
  readonly type: 'message' | 'opinion' | 'review' | 'task' | 'system';
}

/**
 * Immutable discussion session between advisors.
 */
export interface AdvisorDiscussion {
  readonly discussionId: string;
  readonly topic: string;
  readonly participants: readonly AdvisorId[];
  readonly messages: readonly DiscussionMessage[];
  readonly opinions: readonly AdvisorOpinion[];
  readonly reviews: readonly AdvisorReview[];
  readonly consensus?: AdvisorConsensus;
  readonly debate?: AdvisorDebate;
  readonly status: DiscussionStatus;
  readonly startedAt: number;
  readonly completedAt?: number;
  readonly result?: string;
}

/**
 * Creates a frozen AdvisorDiscussion instance.
 */
export function createAdvisorDiscussion(discussion: AdvisorDiscussion): AdvisorDiscussion {
  return Object.freeze({
    ...discussion,
    participants: Object.freeze([...discussion.participants]),
    messages: Object.freeze([...discussion.messages]),
    opinions: Object.freeze([...discussion.opinions]),
    reviews: Object.freeze([...discussion.reviews]),
    ...(discussion.consensus ? { consensus: createAdvisorConsensus(discussion.consensus) } : {}),
    ...(discussion.debate ? { debate: createAdvisorDebate(discussion.debate) } : {}),
  });
}

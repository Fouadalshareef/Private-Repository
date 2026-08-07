import type { IEventBus } from '../../events/IEventBus.js';
import type { AdvisorId } from '../AdvisorIdentity.js';
import type { AdvisorCatalog } from '../AdvisorCatalog.js';
import type {
  AdvisorOpinion,
  AdvisorReview,
  AdvisorDiscussion,
  AdvisorConsensus,
  AdvisorDebate,
  AdvisorInvocation,
  AdvisorTask,
} from './index.js';
import { createAdvisorId } from '../AdvisorIdentity.js';
import {
  createAdvisorOpinion,
  OpinionStatus,
} from './AdvisorOpinion.js';
import {
  createAdvisorReview,
  ApprovalStatus,
} from './AdvisorReview.js';
import {
  createAdvisorInvocation,
  InvocationStatus,
} from './AdvisorInvocation.js';
import {
  createAdvisorTask,
  TaskStatus,
} from './AdvisorTask.js';
import {
  createAdvisorDebate,
  DebateResolution,
} from './AdvisorDebate.js';
import {
  createAdvisorConsensus,
} from './AdvisorConsensus.js';
import {
  createAdvisorDiscussion,
  DiscussionStatus,
} from './AdvisorDiscussion.js';
import {
  CollaborationError,
  AdvisorNotFoundError,
  DiscussionNotFoundError,
  InvalidDiscussionStateError,
  DebateUnresolvedError,
} from './CollaborationError.js';

/**
 * Configuration options for the AdvisorCollaborationEngine.
 */
export interface AdvisorCollaborationEngineConfig {
  readonly catalog: AdvisorCatalog;
  readonly eventBus?: IEventBus;
}

/**
 * Public API for the Advisor Collaboration Engine.
 *
 * Enables advisors to communicate, review each other,
 * reach consensus, and resolve debates.
 */
export interface IAdvisorCollaborationEngine {
  /**
   * Requests an opinion from one advisor about a topic.
   */
  requestOpinion(
    callerId: AdvisorId,
    targetId: AdvisorId,
    topic: string,
    summary: string,
    details: readonly string[],
    recommendations: readonly string[],
    confidence: number,
  ): AdvisorOpinion;

  /**
   * Requests a review of one advisor's work by another.
   */
  requestReview(
    reviewerId: AdvisorId,
    targetId: AdvisorId,
    topic: string,
    summary: string,
    issues: readonly string[],
    recommendations: readonly string[],
  ): AdvisorReview;

  /**
   * Starts a new discussion session with multiple participants.
   */
  startDiscussion(
    facilitatorId: AdvisorId,
    topic: string,
    participantIds: readonly AdvisorId[],
  ): AdvisorDiscussion;

  /**
   * Requests consensus from all participants of a discussion.
   */
  requestConsensus(discussionId: string): AdvisorConsensus;

  /**
   * Starts a debate between two advisors with conflicting positions.
   */
  startDebate(
    advisorAId: AdvisorId,
    advisorBId: AdvisorId,
    topic: string,
    positionA: string,
    positionB: string,
  ): AdvisorDebate;

  /**
   * Escalates an unresolved decision to the Chief AI Architect.
   */
  escalateDecision(discussionId: string, reason: string): AdvisorInvocation;

  /**
   * Retrieves a discussion by ID.
   */
  getDiscussion(discussionId: string): AdvisorDiscussion | undefined;

  /**
   * Lists all discussions.
   */
  listDiscussions(): readonly AdvisorDiscussion[];

  /**
   * Adds a message to an active discussion.
   */
  addMessage(discussionId: string, advisorId: AdvisorId, content: string): AdvisorDiscussion;

  /**
   * Delegates a task from one advisor to another.
   */
  delegateTask(
    fromAdvisorId: AdvisorId,
    toAdvisorId: AdvisorId,
    objective: string,
    priority: number,
    deadline?: number,
  ): AdvisorTask;

  /**
   * Resolves a debate with a specific resolution.
   */
  resolveDebate(debateId: string, resolution: DebateResolution, winner?: AdvisorId): AdvisorDebate;
}

/**
 * Core implementation of the Advisor Collaboration Engine.
 *
 * Manages advisor-to-advisor collaboration including opinions, reviews,
 * discussions, consensus, debates, and task delegation.
 */
export class AdvisorCollaborationEngine implements IAdvisorCollaborationEngine {
  private readonly catalog: AdvisorCatalog;
  private readonly eventBus?: IEventBus;
  private readonly discussions: Map<string, AdvisorDiscussion>;
  private readonly debates: Map<string, AdvisorDebate>;
  private discussionCounter = 0;
  private opinionCounter = 0;
  private reviewCounter = 0;
  private debateCounter = 0;
  private invocationCounter = 0;
  private taskCounter = 0;

  constructor(config: AdvisorCollaborationEngineConfig) {
    this.catalog = config.catalog;
    this.eventBus = config.eventBus;
    this.discussions = new Map();
    this.debates = new Map();
  }

  public requestOpinion(
    callerId: AdvisorId,
    targetId: AdvisorId,
    topic: string,
    summary: string,
    details: readonly string[],
    recommendations: readonly string[],
    confidence: number,
  ): AdvisorOpinion {
    this.validateAdvisorExists(targetId);
    this.validateAdvisorExists(callerId);

    const opinionId = `opinion-${++this.opinionCounter}`;
    const opinion = createAdvisorOpinion({
      opinionId,
      advisorId: targetId,
      topic,
      summary,
      details,
      confidence,
      recommendations,
      createdAt: Date.now(),
      status: OpinionStatus.SUBMITTED,
    });

    this.publishEvent('OpinionCreated', { opinion });
    return opinion;
  }

  public requestReview(
    reviewerId: AdvisorId,
    targetId: AdvisorId,
    topic: string,
    summary: string,
    issues: readonly string[],
    recommendations: readonly string[],
  ): AdvisorReview {
    this.validateAdvisorExists(reviewerId);
    this.validateAdvisorExists(targetId);

    const reviewId = `review-${++this.reviewCounter}`;
    const review = createAdvisorReview({
      reviewId,
      reviewer: reviewerId,
      target: targetId,
      topic,
      summary,
      issues,
      recommendations,
      approvalStatus: ApprovalStatus.PENDING,
      createdAt: Date.now(),
    });

    this.publishEvent('ReviewCompleted', { review });
    return review;
  }

  public startDiscussion(
    facilitatorId: AdvisorId,
    topic: string,
    participantIds: readonly AdvisorId[],
  ): AdvisorDiscussion {
    this.validateAdvisorExists(facilitatorId);

    const allParticipants = [facilitatorId, ...participantIds];
    const uniqueParticipants = this.deduplicateParticipants(allParticipants);

    const discussionId = `discussion-${++this.discussionCounter}`;
    const now = Date.now();

    const discussion = createAdvisorDiscussion({
      discussionId,
      topic,
      participants: Object.freeze(uniqueParticipants),
      messages: Object.freeze([]),
      opinions: Object.freeze([]),
      reviews: Object.freeze([]),
      status: DiscussionStatus.ACTIVE,
      startedAt: now,
    });

    this.discussions.set(discussionId, discussion);
    this.publishEvent('DiscussionStarted', { discussion });

    return discussion;
  }

  public requestConsensus(discussionId: string): AdvisorConsensus {
    const discussion = this.getDiscussionOrThrow(discussionId);

    if (discussion.status !== DiscussionStatus.ACTIVE) {
      throw new InvalidDiscussionStateError(discussion.status);
    }

    const agreedOpinions: { advisorId: AdvisorId; summary: string }[] = [];
    const disagreedOpinions: { advisorId: AdvisorId; summary: string }[] = [];

    for (const opinion of discussion.opinions) {
      if (opinion.confidence >= 0.7) {
        agreedOpinions.push({ advisorId: opinion.advisorId, summary: opinion.summary });
      } else {
        disagreedOpinions.push({ advisorId: opinion.advisorId, summary: opinion.summary });
      }
    }

    const consensus = createAdvisorConsensus({
      consensusId: `consensus-${Date.now()}`,
      discussionId,
      topic: discussion.topic,
      agreedOpinions: Object.freeze(agreedOpinions),
      disagreedOpinions: Object.freeze(disagreedOpinions),
      decision: agreedOpinions.length > disagreedOpinions.length
        ? 'Majority agreement reached'
        : 'No clear consensus',
      reason: `Agreed: ${agreedOpinions.length}, Disagreed: ${disagreedOpinions.length}`,
      confidence: agreedOpinions.length / Math.max(discussion.participants.length, 1),
      createdAt: Date.now(),
    });

    this.publishEvent(disagreedOpinions.length > 0 ? 'ConsensusFailed' : 'ConsensusReached', { consensus });
    return consensus;
  }

  public startDebate(
    advisorAId: AdvisorId,
    advisorBId: AdvisorId,
    topic: string,
    positionA: string,
    positionB: string,
  ): AdvisorDebate {
    this.validateAdvisorExists(advisorAId);
    this.validateAdvisorExists(advisorBId);

    if (advisorAId === advisorBId) {
      throw new CollaborationError('Advisor cannot debate itself');
    }

    const debateId = `debate-${++this.debateCounter}`;
    const debate = createAdvisorDebate({
      debateId,
      advisorA: advisorAId,
      advisorB: advisorBId,
      topic,
      positionA,
      positionB,
      resolved: false,
      createdAt: Date.now(),
    });

    this.debates.set(debateId, debate);
    this.publishEvent('DebateStarted', { debate });
    return debate;
  }

  public escalateDecision(discussionId: string, reason: string): AdvisorInvocation {
    const discussion = this.getDiscussionOrThrow(discussionId);

    const chiefArchitectId = createAdvisorId('chief-ai-architect');
    const invocationId = `invocation-${++this.invocationCounter}`;

    const invocation = createAdvisorInvocation({
      invocationId,
      callerAdvisor: discussion.participants[0],
      targetAdvisor: chiefArchitectId,
      reason: `Escalation from discussion ${discussionId}: ${reason}`,
      timestamp: Date.now(),
      status: InvocationStatus.SENT,
    });

    this.publishEvent('DecisionEscalated', { invocation });
    return invocation;
  }

  public getDiscussion(discussionId: string): AdvisorDiscussion | undefined {
    return this.discussions.get(discussionId);
  }

  public listDiscussions(): readonly AdvisorDiscussion[] {
    return Object.freeze(Array.from(this.discussions.values()));
  }

  public addMessage(discussionId: string, advisorId: AdvisorId, content: string): AdvisorDiscussion {
    const existing = this.getDiscussionOrThrow(discussionId);

    if (!existing.participants.includes(advisorId)) {
      throw new CollaborationError('Advisor is not a participant in this discussion');
    }

    const message = Object.freeze({
      messageId: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      advisorId,
      content,
      timestamp: Date.now(),
      type: 'message' as const,
    });

    const updated = createAdvisorDiscussion({
      ...existing,
      messages: Object.freeze([...existing.messages, message]),
    });

    this.discussions.set(discussionId, updated);
    return updated;
  }

  public delegateTask(
    fromAdvisorId: AdvisorId,
    toAdvisorId: AdvisorId,
    objective: string,
    priority: number,
    deadline?: number,
  ): AdvisorTask {
    this.validateAdvisorExists(fromAdvisorId);
    this.validateAdvisorExists(toAdvisorId);

    const taskId = `task-${++this.taskCounter}`;
    const task = createAdvisorTask({
      taskId,
      fromAdvisor: fromAdvisorId,
      toAdvisor: toAdvisorId,
      objective,
      priority,
      status: TaskStatus.PENDING,
      deadline,
      createdAt: Date.now(),
    });

    this.publishEvent('TaskDelegated', { task });
    return task;
  }

  public resolveDebate(debateId: string, resolution: DebateResolution, winner?: AdvisorId): AdvisorDebate {
    const existing = this.debates.get(debateId);
    if (!existing) {
      throw new DebateUnresolvedError(debateId);
    }

    const resolvedDebate = createAdvisorDebate({
      ...existing,
      resolved: true,
      resolution,
      winner,
      resolvedAt: Date.now(),
    });

    this.debates.set(debateId, resolvedDebate);
    this.publishEvent('DebateResolved', { debate: resolvedDebate });
    return resolvedDebate;
  }

  private validateAdvisorExists(advisorId: AdvisorId | string): void {
    const id = typeof advisorId === 'string' ? advisorId : String(advisorId);
    if (!this.catalog.has(createAdvisorId(id))) {
      throw new AdvisorNotFoundError(id);
    }
  }

  private getDiscussionOrThrow(discussionId: string): AdvisorDiscussion {
    const discussion = this.discussions.get(discussionId);
    if (!discussion) {
      throw new DiscussionNotFoundError(discussionId);
    }
    return discussion;
  }

  private deduplicateParticipants(participants: AdvisorId[]): AdvisorId[] {
    const seen = new Set<string>();
    const result: AdvisorId[] = [];
    for (const participant of participants) {
      const id = String(participant);
      if (!seen.has(id)) {
        seen.add(id);
        result.push(participant);
      }
    }
    return result;
  }

  private publishEvent(type: string, payload: unknown): void {
    if (this.eventBus) {
      this.eventBus.publish({
        type,
        timestamp: Date.now(),
        payload,
      });
    }
  }
}

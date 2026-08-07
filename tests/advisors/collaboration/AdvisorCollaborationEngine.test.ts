import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AdvisorCatalog,
  AdvisorRoles,
  createAdvisorId,
} from '../../../src/advisors/index.js';
import {
  AdvisorCollaborationEngine,
  type IAdvisorCollaborationEngine,
  OpinionStatus,
  ApprovalStatus,
  InvocationStatus,
  TaskStatus,
  DiscussionStatus,
  DebateResolution,
  createAdvisorOpinion,
  createAdvisorReview,
  createAdvisorDebate,
  createAdvisorConsensus,
  createAdvisorDiscussion,
  createAdvisorTask,
  createAdvisorInvocation,
  AdvisorNotFoundError,
  DiscussionNotFoundError,
  InvalidDiscussionStateError,
  DebateUnresolvedError,
  CollaborationError,
} from '../../../src/advisors/index.js';

function createTestCatalog(): AdvisorCatalog {
  return new AdvisorCatalog();
}

function createEngine(catalog: AdvisorCatalog, publishFn?: ReturnType<typeof vi.fn>): IAdvisorCollaborationEngine {
  const eventBus = publishFn
    ? { publish: publishFn }
    : undefined;
  return new AdvisorCollaborationEngine({
    catalog,
    eventBus: eventBus as Parameters<typeof AdvisorCollaborationEngine>[0]['eventBus'],
  });
}

describe('AdvisorCollaborationEngine', () => {
  let catalog: AdvisorCatalog;
  let engine: IAdvisorCollaborationEngine;

  beforeEach(() => {
    catalog = createTestCatalog();
    engine = createEngine(catalog);
  });

  describe('requestOpinion', () => {
    it('should create an opinion from target advisor', () => {
      const opinion = engine.requestOpinion(
        createAdvisorId(AdvisorRoles.CHIEF_AI_ARCHITECT),
        createAdvisorId(AdvisorRoles.SECURITY_ADVISOR),
        'Security review needed',
        'The design is secure',
        ['No vulnerabilities found'],
        ['Add rate limiting'],
        0.9,
      );

      expect(opinion.advisorId).toBe(AdvisorRoles.SECURITY_ADVISOR);
      expect(opinion.topic).toBe('Security review needed');
      expect(opinion.confidence).toBe(0.9);
      expect(opinion.status).toBe(OpinionStatus.SUBMITTED);
    });

    it('should throw AdvisorNotFoundError for missing target advisor', () => {
      expect(() =>
        engine.requestOpinion(
          createAdvisorId(AdvisorRoles.CHIEF_AI_ARCHITECT),
          createAdvisorId('missing-advisor'),
          'Topic',
          'Summary',
          [],
          [],
          0.5,
        ),
      ).toThrow(AdvisorNotFoundError);
    });

    it('should publish OpinionCreated event', () => {
      const publish = vi.fn();
      engine = createEngine(catalog, publish);

      engine.requestOpinion(
        createAdvisorId(AdvisorRoles.CHIEF_AI_ARCHITECT),
        createAdvisorId(AdvisorRoles.SECURITY_ADVISOR),
        'Topic',
        'Summary',
        [],
        [],
        0.5,
      );

      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'OpinionCreated',
          payload: expect.objectContaining({
            opinion: expect.objectContaining({
              topic: 'Topic',
              confidence: 0.5,
            }),
          }),
        }),
      );
    });
  });

  describe('requestReview', () => {
    it('should create a review with pending approval status', () => {
      const review = engine.requestReview(
        createAdvisorId(AdvisorRoles.QA_ENGINEER),
        createAdvisorId(AdvisorRoles.BACKEND_ENGINEER),
        'API design review',
        'Needs improvement',
        ['Missing error handling'],
        ['Add try-catch blocks'],
      );

      expect(review.reviewer).toBe(AdvisorRoles.QA_ENGINEER);
      expect(review.target).toBe(AdvisorRoles.BACKEND_ENGINEER);
      expect(review.approvalStatus).toBe(ApprovalStatus.PENDING);
    });

    it('should throw AdvisorNotFoundError for missing reviewer', () => {
      expect(() =>
        engine.requestReview(
          createAdvisorId('missing'),
          createAdvisorId(AdvisorRoles.BACKEND_ENGINEER),
          'Topic',
          'Summary',
          [],
          [],
        ),
      ).toThrow(AdvisorNotFoundError);
    });
  });

  describe('startDiscussion', () => {
    it('should create a discussion with participants', () => {
      const discussion = engine.startDiscussion(
        createAdvisorId(AdvisorRoles.CHIEF_AI_ARCHITECT),
        'Feature design',
        [createAdvisorId(AdvisorRoles.UI_DESIGNER), createAdvisorId(AdvisorRoles.BACKEND_ENGINEER)],
      );

      expect(discussion.topic).toBe('Feature design');
      expect(discussion.participants).toHaveLength(3);
      expect(discussion.status).toBe(DiscussionStatus.ACTIVE);
    });

    it('should deduplicate participants', () => {
      const discussion = engine.startDiscussion(
        createAdvisorId(AdvisorRoles.CHIEF_AI_ARCHITECT),
        'Topic',
        [createAdvisorId(AdvisorRoles.UI_DESIGNER), createAdvisorId(AdvisorRoles.UI_DESIGNER)],
      );

      const uiDesignerCount = discussion.participants.filter((id) => String(id) === AdvisorRoles.UI_DESIGNER).length;
      expect(uiDesignerCount).toBe(1);
    });

    it('should throw AdvisorNotFoundError for missing facilitator', () => {
      expect(() =>
        engine.startDiscussion(
          createAdvisorId('missing'),
          'Topic',
          [createAdvisorId(AdvisorRoles.UI_DESIGNER)],
        ),
      ).toThrow(AdvisorNotFoundError);
    });

    it('should publish DiscussionStarted event', () => {
      const publish = vi.fn();
      engine = createEngine(catalog, publish);

      engine.startDiscussion(
        createAdvisorId(AdvisorRoles.CHIEF_AI_ARCHITECT),
        'Topic',
        [createAdvisorId(AdvisorRoles.UI_DESIGNER)],
      );

      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DiscussionStarted',
        }),
      );
    });
  });

  describe('requestConsensus', () => {
    it('should return consensus from opinions', () => {
      const discussion = engine.startDiscussion(
        createAdvisorId(AdvisorRoles.CHIEF_AI_ARCHITECT),
        'Topic',
        [createAdvisorId(AdvisorRoles.UI_DESIGNER), createAdvisorId(AdvisorRoles.BACKEND_ENGINEER)],
      );

      const consensus = engine.requestConsensus(discussion.discussionId);
      expect(consensus.topic).toBe('Topic');
    });

    it('should throw DiscussionNotFoundError for missing discussion', () => {
      expect(() => engine.requestConsensus('missing-discussion')).toThrow(DiscussionNotFoundError);
    });

    it('should throw InvalidDiscussionStateError for non-active discussion', () => {
      const discussion = engine.startDiscussion(
        createAdvisorId(AdvisorRoles.CHIEF_AI_ARCHITECT),
        'Topic',
        [createAdvisorId(AdvisorRoles.UI_DESIGNER)],
      );

      const invalidDiscussion = createAdvisorDiscussion({
        ...discussion,
        status: DiscussionStatus.COMPLETED,
      });

      const discussions = new Map<string, ReturnType<typeof createAdvisorDiscussion>>();
      discussions.set(discussion.discussionId, invalidDiscussion);

      const directEngine = new AdvisorCollaborationEngine({
        catalog,
        eventBus: undefined,
      });
      Object.defineProperty(directEngine, 'discussions', {
        get: () => discussions,
      });

      expect(() => directEngine.requestConsensus(discussion.discussionId)).toThrow(InvalidDiscussionStateError);
    });
  });

  describe('startDebate', () => {
    it('should create a debate between two advisors', () => {
      const debate = engine.startDebate(
        createAdvisorId(AdvisorRoles.UI_DESIGNER),
        createAdvisorId(AdvisorRoles.BACKEND_ENGINEER),
        'API design',
        'REST is better',
        'GraphQL is better',
      );

      expect(debate.topic).toBe('API design');
      expect(debate.resolved).toBe(false);
    });

    it('should throw CollaborationError for self-debate', () => {
      expect(() =>
        engine.startDebate(
          createAdvisorId(AdvisorRoles.UI_DESIGNER),
          createAdvisorId(AdvisorRoles.UI_DESIGNER),
          'Topic',
          'A',
          'B',
        ),
      ).toThrow(CollaborationError);
    });

    it('should throw AdvisorNotFoundError for missing advisor', () => {
      expect(() =>
        engine.startDebate(
          createAdvisorId('missing'),
          createAdvisorId(AdvisorRoles.UI_DESIGNER),
          'Topic',
          'A',
          'B',
        ),
      ).toThrow(AdvisorNotFoundError);
    });
  });

  describe('escalateDecision', () => {
    it('should escalate to Chief AI Architect', () => {
      const discussion = engine.startDiscussion(
        createAdvisorId(AdvisorRoles.CHIEF_AI_ARCHITECT),
        'Topic',
        [createAdvisorId(AdvisorRoles.UI_DESIGNER)],
      );

      const invocation = engine.escalateDecision(discussion.discussionId, 'No consensus');
      expect(invocation.targetAdvisor).toBe('chief-ai-architect');
      expect(invocation.status).toBe(InvocationStatus.SENT);
    });

    it('should throw DiscussionNotFoundError for missing discussion', () => {
      expect(() => engine.escalateDecision('missing', 'reason')).toThrow(DiscussionNotFoundError);
    });
  });

  describe('addMessage', () => {
    it('should add message to discussion', () => {
      const discussion = engine.startDiscussion(
        createAdvisorId(AdvisorRoles.CHIEF_AI_ARCHITECT),
        'Topic',
        [createAdvisorId(AdvisorRoles.UI_DESIGNER)],
      );

      const updated = engine.addMessage(discussion.discussionId, createAdvisorId(AdvisorRoles.UI_DESIGNER), 'Hello');
      expect(updated.messages).toHaveLength(1);
      expect(updated.messages[0].content).toBe('Hello');
    });

    it('should throw error for non-participant', () => {
      const discussion = engine.startDiscussion(
        createAdvisorId(AdvisorRoles.CHIEF_AI_ARCHITECT),
        'Topic',
        [createAdvisorId(AdvisorRoles.UI_DESIGNER)],
      );

      expect(() =>
        engine.addMessage(discussion.discussionId, createAdvisorId(AdvisorRoles.BACKEND_ENGINEER), 'Hello'),
      ).toThrow(CollaborationError);
    });
  });

  describe('delegateTask', () => {
    it('should create a delegated task', () => {
      const task = engine.delegateTask(
        createAdvisorId(AdvisorRoles.CHIEF_AI_ARCHITECT),
        createAdvisorId(AdvisorRoles.BACKEND_ENGINEER),
        'Implement API',
        1,
        Date.now() + 86400000,
      );

      expect(task.fromAdvisor).toBe(AdvisorRoles.CHIEF_AI_ARCHITECT);
      expect(task.toAdvisor).toBe(AdvisorRoles.BACKEND_ENGINEER);
      expect(task.status).toBe(TaskStatus.PENDING);
    });

    it('should throw AdvisorNotFoundError for missing advisor', () => {
      expect(() =>
        engine.delegateTask(
          createAdvisorId('missing'),
          createAdvisorId(AdvisorRoles.BACKEND_ENGINEER),
          'Task',
          1,
        ),
      ).toThrow(AdvisorNotFoundError);
    });
  });

  describe('resolveDebate', () => {
    it('should resolve a debate', () => {
      const debate = engine.startDebate(
        createAdvisorId(AdvisorRoles.UI_DESIGNER),
        createAdvisorId(AdvisorRoles.BACKEND_ENGINEER),
        'Topic',
        'A',
        'B',
      );

      const resolved = engine.resolveDebate(debate.debateId, DebateResolution.ADVISOR_A, debate.advisorA);
      expect(resolved.resolved).toBe(true);
      expect(resolved.resolution).toBe(DebateResolution.ADVISOR_A);
    });

    it('should throw DebateUnresolvedError for missing debate', () => {
      expect(() => engine.resolveDebate('missing', DebateResolution.COMPROMISE)).toThrow(DebateUnresolvedError);
    });
  });

  describe('listDiscussions', () => {
    it('should return all discussions', () => {
      engine.startDiscussion(
        createAdvisorId(AdvisorRoles.CHIEF_AI_ARCHITECT),
        'Topic 1',
        [createAdvisorId(AdvisorRoles.UI_DESIGNER)],
      );
      engine.startDiscussion(
        createAdvisorId(AdvisorRoles.CHIEF_AI_ARCHITECT),
        'Topic 2',
        [createAdvisorId(AdvisorRoles.BACKEND_ENGINEER)],
      );

      const discussions = engine.listDiscussions();
      expect(discussions).toHaveLength(2);
    });
  });
});

describe('Collaboration Models', () => {
  describe('createAdvisorOpinion', () => {
    it('should create a frozen opinion', () => {
      const opinion = createAdvisorOpinion({
        opinionId: 'opinion-1',
        advisorId: createAdvisorId('security-advisor'),
        topic: 'Security',
        summary: 'Secure',
        details: ['No issues'],
        confidence: 0.9,
        recommendations: ['Add encryption'],
        createdAt: Date.now(),
        status: OpinionStatus.SUBMITTED,
      });

      expect(Object.isFrozen(opinion)).toBe(true);
      expect(Object.isFrozen(opinion.details)).toBe(true);
      expect(Object.isFrozen(opinion.recommendations)).toBe(true);
    });
  });

  describe('createAdvisorReview', () => {
    it('should create a frozen review', () => {
      const review = createAdvisorReview({
        reviewId: 'review-1',
        reviewer: createAdvisorId('qa'),
        target: createAdvisorId('backend'),
        topic: 'Code review',
        summary: 'Good',
        issues: ['Missing tests'],
        recommendations: ['Add tests'],
        approvalStatus: ApprovalStatus.PENDING,
        createdAt: Date.now(),
      });

      expect(Object.isFrozen(review)).toBe(true);
      expect(Object.isFrozen(review.issues)).toBe(true);
      expect(Object.isFrozen(review.recommendations)).toBe(true);
    });
  });

  describe('createAdvisorDebate', () => {
    it('should create a frozen debate', () => {
      const debate = createAdvisorDebate({
        debateId: 'debate-1',
        advisorA: createAdvisorId('ui'),
        advisorB: createAdvisorId('backend'),
        topic: 'Design',
        positionA: 'React',
        positionB: 'Vue',
        resolved: false,
        createdAt: Date.now(),
      });

      expect(Object.isFrozen(debate)).toBe(true);
    });
  });

  describe('createAdvisorConsensus', () => {
    it('should create a frozen consensus', () => {
      const consensus = createAdvisorConsensus({
        consensusId: 'consensus-1',
        discussionId: 'discussion-1',
        topic: 'Design',
        agreedOpinions: [{ advisorId: createAdvisorId('ui'), summary: 'Agree' }],
        disagreedOpinions: [],
        decision: 'Use React',
        reason: 'Majority agreed',
        confidence: 0.8,
        createdAt: Date.now(),
      });

      expect(Object.isFrozen(consensus)).toBe(true);
      expect(Object.isFrozen(consensus.agreedOpinions)).toBe(true);
      expect(Object.isFrozen(consensus.disagreedOpinions)).toBe(true);
    });
  });

  describe('createAdvisorDiscussion', () => {
    it('should create a frozen discussion', () => {
      const discussion = createAdvisorDiscussion({
        discussionId: 'discussion-1',
        topic: 'Feature',
        participants: [createAdvisorId('ui'), createAdvisorId('backend')],
        messages: [],
        opinions: [],
        reviews: [],
        status: DiscussionStatus.ACTIVE,
        startedAt: Date.now(),
      });

      expect(Object.isFrozen(discussion)).toBe(true);
      expect(Object.isFrozen(discussion.participants)).toBe(true);
      expect(Object.isFrozen(discussion.messages)).toBe(true);
    });
  });

  describe('createAdvisorTask', () => {
    it('should create a frozen task', () => {
      const task = createAdvisorTask({
        taskId: 'task-1',
        fromAdvisor: createAdvisorId('chief'),
        toAdvisor: createAdvisorId('backend'),
        objective: 'Implement API',
        priority: 1,
        status: TaskStatus.PENDING,
        createdAt: Date.now(),
      });

      expect(Object.isFrozen(task)).toBe(true);
    });
  });

  describe('createAdvisorInvocation', () => {
    it('should create a frozen invocation', () => {
      const invocation = createAdvisorInvocation({
        invocationId: 'invocation-1',
        callerAdvisor: createAdvisorId('chief'),
        targetAdvisor: createAdvisorId('security'),
        reason: 'Need review',
        timestamp: Date.now(),
        status: InvocationStatus.SENT,
      });

      expect(Object.isFrozen(invocation)).toBe(true);
    });
  });
});

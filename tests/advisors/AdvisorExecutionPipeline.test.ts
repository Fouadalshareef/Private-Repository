import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvisorExecutionPipeline } from '../../src/advisors/AdvisorExecutionPipeline.js';
import { AdvisorCatalog } from '../../src/advisors/AdvisorCatalog.js';
import { AdvisorRoles, createAdvisorId, createAdvisorCapability, createAdvisorProfile } from '../../src/advisors/index.js';
import { AdvisorFactory } from '../../src/advisors/AdvisorFactory.js';
import { InvalidAdvisorSessionError } from '../../src/advisors/AdvisorError.js';
import { MessageRole } from '../../src/ai/AIMessage.js';
import type { IAdvisor } from '../../src/advisors/IAdvisor.js';
import type { IAdvisorPromptComposer, AdvisorPromptResult } from '../../src/advisors/IAdvisorPromptComposer.js';
import type { IAdvisorOrchestrator, OrchestrationPlan, OrchestrationResult, StepResult } from '../../src/advisors/IAdvisorOrchestrator.js';
import type { IConversationMemory, ConversationSession } from '../../src/context/IConversationMemory.js';
import type { AIMessage } from '../../src/ai/AIMessage.js';
import type { ITool } from '../../src/tools/ITool.js';

// --- Mock Implementations ---

function createMockConversationMemory(): IConversationMemory {
  const sessions = new Map<string, ConversationSession>();
  return {
    createSession: vi.fn((sessionId: string, options?: { metadata?: Readonly<Record<string, unknown>> }) => {
      const now = new Date();
      const session: ConversationSession = {
        sessionId,
        messages: [],
        createdAt: now,
        updatedAt: now,
        ...(options?.metadata ? { metadata: options.metadata } : {}),
      };
      sessions.set(sessionId, session);
      return session;
    }),
    getSession: vi.fn((sessionId: string) => {
      const session = sessions.get(sessionId);
      if (!session) return undefined;
      return { ...session, messages: Object.freeze([...session.messages]) };
    }),
    addMessage: vi.fn((sessionId: string, message: AIMessage) => {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);
      sessions.set(sessionId, {
        ...session,
        messages: [...session.messages, message],
        updatedAt: new Date(),
      });
    }),
    addMessages: vi.fn((sessionId: string, messages: readonly AIMessage[]) => {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);
      sessions.set(sessionId, {
        ...session,
        messages: [...session.messages, ...messages],
        updatedAt: new Date(),
      });
    }),
    clearSession: vi.fn((sessionId: string) => {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);
      sessions.set(sessionId, { ...session, messages: [], updatedAt: new Date() });
    }),
    deleteSession: vi.fn((sessionId: string) => {
      if (!sessions.has(sessionId)) throw new Error(`Session not found: ${sessionId}`);
      sessions.delete(sessionId);
    }),
    getSessionIds: vi.fn(() => Array.from(sessions.keys())),
    get sessionCount() {
      return sessions.size;
    },
  };
}

function createMockPromptComposer(): IAdvisorPromptComposer {
  return {
    compose: vi.fn((advisor: IAdvisor): AdvisorPromptResult => {
      const result: AdvisorPromptResult = {
        advisorId: advisor.id,
        promptResult: {
          messages: [
            { role: MessageRole.SYSTEM, content: advisor.profile.systemPrompt },
            { role: MessageRole.USER, content: 'test input' },
          ],
          tokenCount: 100,
          truncated: false,
        },
        systemPrompt: advisor.profile.systemPrompt,
        tokenBreakdown: {
          systemPrompt: 50,
          userInput: 10,
          contextSnippets: 20,
          conversationHistory: 0,
          total: 80,
        },
      };
      return Object.freeze(result);
    }),
    validate: vi.fn(() => true),
  };
}

function createMockOrchestrator(): IAdvisorOrchestrator {
  return {
    execute: vi.fn((plan: OrchestrationPlan): OrchestrationResult => {
      const stepResults: StepResult[] = plan.steps.map((step) => {
        const stepResult: StepResult = {
          step,
          advisor: { id: step.advisorId, profile: { name: 'Mock', description: '', specialty: '', responsibilities: [], systemPrompt: '', capabilities: [], allowedTools: [], metadata: {} } } as unknown as IAdvisor,
          success: true,
          output: `[${step.advisorId}] Processed: "${step.input}"`,
          retries: 0,
          timestamp: Date.now(),
        };
        return Object.freeze(stepResult);
      });

      const result: OrchestrationResult = {
        plan,
        stepResults: Object.freeze([...stepResults]),
        success: true,
        aggregatedOutput: stepResults.map((r) => r.output).join('\n\n'),
        durationMs: 10,
        startedAt: Date.now(),
        completedAt: Date.now(),
      };
      return Object.freeze(result);
    }),
    validate: vi.fn(() => true),
  };
}

function createTestAdvisor(): IAdvisor {
  const factory = new AdvisorFactory();
  return factory.create({
    id: createAdvisorId('test-advisor'),
    profile: createAdvisorProfile({
      name: 'Test Advisor',
      description: 'A test advisor',
      specialty: 'Testing',
      responsibilities: ['Write tests', 'Review code'],
      systemPrompt: 'You are a test advisor.',
      capabilities: [createAdvisorCapability('testing')],
      allowedTools: ['read_file', 'write_file'],
      metadata: { role: 'tester' },
    }),
  });
}

function createMockTool(): ITool {
  return {
    name: 'test_tool',
    description: 'A test tool',
    parameters: {
      type: 'object',
      properties: {},
    },
    handler: vi.fn(),
  };
}

// --- Tests ---

describe('AdvisorExecutionPipeline', () => {
  let pipeline: AdvisorExecutionPipeline;
  let mockMemory: IConversationMemory;
  let mockComposer: IAdvisorPromptComposer;
  let mockOrchestrator: IAdvisorOrchestrator;
  let advisor: IAdvisor;

  beforeEach(() => {
    mockMemory = createMockConversationMemory();
    mockComposer = createMockPromptComposer();
    mockOrchestrator = createMockOrchestrator();
    advisor = createTestAdvisor();

    pipeline = new AdvisorExecutionPipeline({
      conversationMemory: mockMemory,
      promptComposer: mockComposer,
      orchestrator: mockOrchestrator,
    });
  });

  describe('Session Management', () => {
    it('should create a session and return a session ID', () => {
      const sessionId = pipeline.createSession({ advisor });
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });

    it('should create a session with metadata', () => {
      const sessionId = pipeline.createSession({
        advisor,
        metadata: { purpose: 'testing' },
      });
      const session = pipeline.getConversationSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.metadata?.purpose).toBe('testing');
    });

    it('should create a session with initial context', () => {
      const sessionId = pipeline.createSession({
        advisor,
        initialContext: { key: 'value' },
      });
      expect(sessionId).toBeDefined();
    });

    it('should create a session with custom tools', () => {
      const tool = createMockTool();
      const sessionId = pipeline.createSession({
        advisor,
        tools: [tool],
      });
      expect(sessionId).toBeDefined();
    });

    it('should track active sessions', () => {
      expect(pipeline.activeSessionCount).toBe(0);
      pipeline.createSession({ advisor });
      expect(pipeline.activeSessionCount).toBe(1);
      pipeline.createSession({ advisor });
      expect(pipeline.activeSessionCount).toBe(2);
    });

    it('should return all active session IDs', () => {
      const id1 = pipeline.createSession({ advisor });
      const id2 = pipeline.createSession({ advisor });
      const sessions = pipeline.getActiveSessions();
      expect(sessions).toContain(id1);
      expect(sessions).toContain(id2);
      expect(sessions.length).toBe(2);
    });

    it('should delete a session', () => {
      const sessionId = pipeline.createSession({ advisor });
      expect(pipeline.activeSessionCount).toBe(1);
      pipeline.deleteSession(sessionId);
      expect(pipeline.activeSessionCount).toBe(0);
      expect(pipeline.getActiveSessions()).not.toContain(sessionId);
    });

    it('should clear session conversation history', () => {
      const sessionId = pipeline.createSession({ advisor });
      pipeline.addMessage(sessionId, { role: MessageRole.USER, content: 'Hello' });
      const session = pipeline.getConversationSession(sessionId);
      expect(session?.messages.length).toBe(1);
      pipeline.clearSession(sessionId);
      const clearedSession = pipeline.getConversationSession(sessionId);
      expect(clearedSession?.messages.length).toBe(0);
    });

    it('should retrieve conversation session', () => {
      const sessionId = pipeline.createSession({ advisor });
      const session = pipeline.getConversationSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe(sessionId);
    });

    it('should return undefined for non-existent session', () => {
      const session = pipeline.getConversationSession('non-existent');
      expect(session).toBeUndefined();
    });
  });

  describe('executeStep', () => {
    it('should execute a step and return a result', async () => {
      const sessionId = pipeline.createSession({ advisor });
      const result = await pipeline.executeStep(sessionId, {
        input: 'Write a function',
      });

      expect(result).toBeDefined();
      expect(result.sessionId).toBe(sessionId);
      expect(result.success).toBe(true);
      expect(result.response).toContain('Processed');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should return frozen result', async () => {
      const sessionId = pipeline.createSession({ advisor });
      const result = await pipeline.executeStep(sessionId, {
        input: 'Test',
      });
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should return frozen messages array', async () => {
      const sessionId = pipeline.createSession({ advisor });
      const result = await pipeline.executeStep(sessionId, {
        input: 'Test',
      });
      expect(Object.isFrozen(result.messages)).toBe(true);
    });

    it('should include composed prompt in result', async () => {
      const sessionId = pipeline.createSession({ advisor });
      const result = await pipeline.executeStep(sessionId, {
        input: 'Test input',
      });
      expect(result.composedPrompt).toBeDefined();
      expect(result.composedPrompt.advisorId).toBe(advisor.id);
      expect(result.composedPrompt.systemPrompt).toBe(advisor.profile.systemPrompt);
    });

    it('should add user and assistant messages to conversation', async () => {
      const sessionId = pipeline.createSession({ advisor });
      await pipeline.executeStep(sessionId, {
        input: 'Hello advisor',
      });
      const session = pipeline.getConversationSession(sessionId);
      expect(session?.messages.length).toBe(2);
      expect(session?.messages[0].role).toBe(MessageRole.USER);
      expect(session?.messages[0].content).toBe('Hello advisor');
      expect(session?.messages[1].role).toBe(MessageRole.ASSISTANT);
    });

    it('should pass context snippets to orchestrator', async () => {
      const sessionId = pipeline.createSession({ advisor });
      await pipeline.executeStep(sessionId, {
        input: 'Test',
        contextSnippets: ['context1', 'context2'],
      });
      expect(mockOrchestrator.execute).toHaveBeenCalled();
    });

    it('should throw InvalidAdvisorSessionError for non-existent session', async () => {
      await expect(
        pipeline.executeStep('non-existent-session', { input: 'Test' }),
      ).rejects.toThrow(InvalidAdvisorSessionError);
    });

    it('should handle orchestrator failure gracefully', async () => {
      const failingOrchestrator: IAdvisorOrchestrator = {
        execute: vi.fn(() => {
          throw new Error('Orchestrator failure');
        }),
        validate: vi.fn(() => true),
      };

      const failingPipeline = new AdvisorExecutionPipeline({
        conversationMemory: mockMemory,
        promptComposer: mockComposer,
        orchestrator: failingOrchestrator,
      });

      const sessionId = failingPipeline.createSession({ advisor });
      const result = await failingPipeline.executeStep(sessionId, {
        input: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Orchestrator failure');
      expect(result.response).toBe('');
    });

    it('should handle prompt composer failure gracefully', async () => {
      const failingComposer: IAdvisorPromptComposer = {
        compose: vi.fn(() => {
          throw new Error('Composer failure');
        }),
        validate: vi.fn(() => true),
      };

      const failingPipeline = new AdvisorExecutionPipeline({
        conversationMemory: mockMemory,
        promptComposer: failingComposer,
        orchestrator: mockOrchestrator,
      });

      const sessionId = failingPipeline.createSession({ advisor });
      const result = await failingPipeline.executeStep(sessionId, {
        input: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Composer failure');
    });
  });

  describe('executePlan', () => {
    it('should execute a plan and return result', async () => {
      const sessionId = pipeline.createSession({ advisor });
      const plan: OrchestrationPlan = {
        id: 'plan-1',
        name: 'Test Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: advisor.id,
            strategy: 'sequential',
            input: 'First step',
          },
        ],
      };

      const result = await pipeline.executePlan(sessionId, plan);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.stepResults.length).toBe(1);
      expect(result.stepResults[0].output).toContain('First step');
    });

    it('should throw InvalidAdvisorSessionError for non-existent session', async () => {
      const plan: OrchestrationPlan = {
        id: 'plan-1',
        name: 'Test Plan',
        steps: [],
      };
      await expect(pipeline.executePlan('non-existent', plan)).rejects.toThrow(
        InvalidAdvisorSessionError,
      );
    });

    it('should execute multi-step plan', async () => {
      const sessionId = pipeline.createSession({ advisor });
      const plan: OrchestrationPlan = {
        id: 'plan-2',
        name: 'Multi-step Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: advisor.id,
            strategy: 'sequential',
            input: 'Step 1',
          },
          {
            id: 'step-2',
            advisorId: advisor.id,
            strategy: 'sequential',
            input: 'Step 2',
            dependsOn: ['step-1'],
          },
        ],
      };

      const result = await pipeline.executePlan(sessionId, plan);
      expect(result.stepResults.length).toBe(2);
      expect(result.aggregatedOutput).toContain('Step 1');
      expect(result.aggregatedOutput).toContain('Step 2');
    });
  });

  describe('addMessage', () => {
    it('should add a message to conversation', () => {
      const sessionId = pipeline.createSession({ advisor });
      const message: AIMessage = {
        role: MessageRole.USER,
        content: 'Hello',
      };
      pipeline.addMessage(sessionId, message);
      const session = pipeline.getConversationSession(sessionId);
      expect(session?.messages.length).toBe(1);
      expect(session?.messages[0].content).toBe('Hello');
    });

    it('should throw for non-existent session', () => {
      const message: AIMessage = {
        role: MessageRole.USER,
        content: 'Hello',
      };
      expect(() => pipeline.addMessage('non-existent', message)).toThrow();
    });
  });

  describe('Default tools and max tokens', () => {
    it('should use default tools when no tools provided in session', () => {
      const tool = createMockTool();
      const pipelineWithDefaults = new AdvisorExecutionPipeline({
        conversationMemory: mockMemory,
        promptComposer: mockComposer,
        orchestrator: mockOrchestrator,
        defaultTools: [tool],
      });

      const sessionId = pipelineWithDefaults.createSession({ advisor });
      expect(sessionId).toBeDefined();
    });

    it('should use default max tokens when not provided', () => {
      const pipelineWithDefaults = new AdvisorExecutionPipeline({
        conversationMemory: mockMemory,
        promptComposer: mockComposer,
        orchestrator: mockOrchestrator,
        defaultMaxTokens: 2000,
      });

      const sessionId = pipelineWithDefaults.createSession({ advisor });
      expect(sessionId).toBeDefined();
    });
  });

  describe('Integration with real components', () => {
    it('should work with real ConversationMemory', async () => {
      const { ConversationMemory } = await import('../../src/context/ConversationMemory.js');
      const realMemory = new ConversationMemory();
      const pipelineWithRealMemory = new AdvisorExecutionPipeline({
        conversationMemory: realMemory,
        promptComposer: mockComposer,
        orchestrator: mockOrchestrator,
      });

      const sessionId = pipelineWithRealMemory.createSession({ advisor });
      expect(sessionId).toBeDefined();
      expect(pipelineWithRealMemory.activeSessionCount).toBe(1);

      const result = await pipelineWithRealMemory.executeStep(sessionId, {
        input: 'Test input',
      });
      expect(result.success).toBe(true);
      expect(result.response).toContain('Processed');
    });

    it('should work with real AdvisorCatalog advisors', async () => {
      const catalog = new AdvisorCatalog();
      const realAdvisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;

      const sessionId = pipeline.createSession({ advisor: realAdvisor });
      const result = await pipeline.executeStep(sessionId, {
        input: 'Write code',
      });

      expect(result.success).toBe(true);
      expect(result.composedPrompt.advisorId).toBe(realAdvisor.id);
    });

    it('should work with all 11 catalog advisors', async () => {
      const catalog = new AdvisorCatalog();
      const advisors = catalog.getAll();

      for (const adv of advisors) {
        const sessionId = pipeline.createSession({ advisor: adv });
        const result = await pipeline.executeStep(sessionId, {
          input: 'Test',
        });
        expect(result.success).toBe(true);
        expect(result.composedPrompt.advisorId).toBe(adv.id);
      }
    });
  });

  describe('Immutability', () => {
    it('should return frozen session IDs array', () => {
      pipeline.createSession({ advisor });
      pipeline.createSession({ advisor });
      const sessions = pipeline.getActiveSessions();
      expect(Object.isFrozen(sessions)).toBe(true);
    });

    it('should return frozen step result', async () => {
      const sessionId = pipeline.createSession({ advisor });
      const result = await pipeline.executeStep(sessionId, {
        input: 'Test',
      });
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.messages)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty input', async () => {
      const sessionId = pipeline.createSession({ advisor });
      const result = await pipeline.executeStep(sessionId, {
        input: '',
      });
      expect(result).toBeDefined();
    });

    it('should handle multiple sessions independently', async () => {
      const id1 = pipeline.createSession({ advisor });
      const id2 = pipeline.createSession({ advisor });

      await pipeline.executeStep(id1, { input: 'Session 1' });
      await pipeline.executeStep(id2, { input: 'Session 2' });

      const session1 = pipeline.getConversationSession(id1);
      const session2 = pipeline.getConversationSession(id2);

      expect(session1?.messages.length).toBe(2);
      expect(session2?.messages.length).toBe(2);
      expect(session1?.messages[0].content).toBe('Session 1');
      expect(session2?.messages[0].content).toBe('Session 2');
    });

    it('should handle session deletion and recreation', () => {
      const sessionId = pipeline.createSession({ advisor });
      pipeline.deleteSession(sessionId);
      expect(pipeline.activeSessionCount).toBe(0);

      // Should be able to create a new session
      const newSessionId = pipeline.createSession({ advisor });
      expect(pipeline.activeSessionCount).toBe(1);
      expect(newSessionId).not.toBe(sessionId);
    });

    it('should handle context snippets in executeStep', async () => {
      const sessionId = pipeline.createSession({ advisor });
      const result = await pipeline.executeStep(sessionId, {
        input: 'Test',
        contextSnippets: ['snippet1', 'snippet2'],
      });
      expect(result.success).toBe(true);
    });

    it('should handle maxTokens override in executeStep', async () => {
      const sessionId = pipeline.createSession({ advisor });
      const result = await pipeline.executeStep(sessionId, {
        input: 'Test',
        maxTokens: 500,
      });
      expect(result.success).toBe(true);
    });
  });
});

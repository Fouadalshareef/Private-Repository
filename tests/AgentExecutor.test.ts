import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentExecutor } from '../src/agent/AgentExecutor.js';
import { AgentExecutionError, AgentStreamError, AgentToolLoopError } from '../src/agent/AgentError.js';
import { AgentEvents } from '../src/agent/AgentEvents.js';
import { MockAIProvider } from '../src/ai/MockAIProvider.js';
import { PromptEngine } from '../src/prompt/PromptEngine.js';
import { ConversationMemory } from '../src/context/ConversationMemory.js';
import { ContextWindowStrategy } from '../src/context/ContextWindowStrategy.js';
import { EventBus } from '../src/events/EventBus.js';
import { Logger } from '../src/logging/Logger.js';
import { ToolRegistry } from '../src/tools/ToolRegistry.js';
import { ToolExecutor } from '../src/tools/ToolExecutor.js';
import { MessageRole } from '../src/ai/AIMessage.js';
import { FinishReason } from '../src/ai/AIResponse.js';
import type { AIResponse } from '../src/ai/AIResponse.js';
import type { Event } from '../src/events/EventTypes.js';
import type { ITool } from '../src/tools/ITool.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeToolCallResponse(content: string, toolName: string, toolArgs: Record<string, unknown>, callId: string): AIResponse {
  return {
    content,
    finishReason: FinishReason.TOOL_CALLS,
    toolCalls: [{ id: callId, name: toolName, args: toolArgs }],
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    model: 'mock-model-v1',
  };
}

function makeFinalResponse(content: string): AIResponse {
  return {
    content,
    finishReason: FinishReason.STOP,
    usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
    model: 'mock-model-v1',
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('AgentExecutor', () => {
  let aiProvider: MockAIProvider;
  let promptEngine: PromptEngine;
  let memory: ConversationMemory;
  let eventBus: EventBus;
  let logger: Logger;
  let executor: AgentExecutor;

  beforeEach(() => {
    aiProvider = new MockAIProvider({ defaultResponse: 'Mock provider response' });
    promptEngine = new PromptEngine();
    memory = new ConversationMemory();
    eventBus = new EventBus();
    logger = new Logger();
    executor = new AgentExecutor({
      aiProvider,
      promptEngine,
      memory,
      eventBus,
      logger,
    });
  });

  // -------------------------------------------------------------------------
  // Single-turn execution (backward compat)
  // -------------------------------------------------------------------------
  describe('execute (single-turn, no tools)', () => {
    it('should complete an execution cycle successfully', async () => {
      const result = await executor.execute({
        sessionId: 'session-1',
        prompt: 'Greetings {{name}}!',
        variables: { name: 'World' },
      });

      expect(result.sessionId).toBe('session-1');
      expect(result.response.content).toBe('Mock provider response');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.toolLoopsCompleted).toBe(0);

      const session = memory.getSession('session-1');
      expect(session?.messages).toHaveLength(2);
      expect(session?.messages[0].role).toBe(MessageRole.USER);
      expect(session?.messages[0].content).toBe('Greetings World!');
      expect(session?.messages[1].role).toBe(MessageRole.ASSISTANT);
      expect(session?.messages[1].content).toBe('Mock provider response');
    });

    it('should include system prompt if provided', async () => {
      await executor.execute({
        sessionId: 'session-1',
        systemPrompt: 'You are a {{role}}.',
        prompt: 'Help me',
        variables: { role: 'coding assistant' },
      });

      const session = memory.getSession('session-1');
      expect(session?.messages).toHaveLength(3);
      expect(session?.messages[0].role).toBe(MessageRole.SYSTEM);
      expect(session?.messages[0].content).toBe('You are a coding assistant.');
    });

    it('should maintain multi-turn history in conversation memory', async () => {
      await executor.execute({ sessionId: 'session-1', prompt: 'First turn' });
      await executor.execute({ sessionId: 'session-1', prompt: 'Second turn' });

      const session = memory.getSession('session-1');
      expect(session?.messages).toHaveLength(4);
      expect(session?.messages[0].content).toBe('First turn');
      expect(session?.messages[2].content).toBe('Second turn');
    });

    it('should emit EXECUTION_STARTED and EXECUTION_COMPLETED events', async () => {
      const events: Event[] = [];
      eventBus.subscribe(AgentEvents.EXECUTION_STARTED, (e) => events.push(e));
      eventBus.subscribe(AgentEvents.EXECUTION_COMPLETED, (e) => events.push(e));

      await executor.execute({ sessionId: 'session-1', prompt: 'Test event emission' });

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe(AgentEvents.EXECUTION_STARTED);
      expect(events[1].type).toBe(AgentEvents.EXECUTION_COMPLETED);
    });

    it('should handle provider errors gracefully and emit EXECUTION_FAILED', async () => {
      const failingProvider = new MockAIProvider();
      vi.spyOn(failingProvider, 'complete').mockRejectedValue(new Error('Provider failure'));

      const failingExecutor = new AgentExecutor({
        aiProvider: failingProvider,
        promptEngine,
        memory,
        eventBus,
        logger,
      });

      const failedEvents: Event[] = [];
      eventBus.subscribe(AgentEvents.EXECUTION_FAILED, (e) => failedEvents.push(e));

      await expect(
        failingExecutor.execute({ sessionId: 'session-1', prompt: 'Will fail' }),
      ).rejects.toThrow(AgentExecutionError);

      expect(failedEvents).toHaveLength(1);
      expect(failedEvents[0].type).toBe(AgentEvents.EXECUTION_FAILED);
    });

    it('should trim context window when strategy and maxTokens provided', async () => {
      const strategy = new ContextWindowStrategy();
      await executor.execute({
        sessionId: 'session-1',
        systemPrompt: 'System prompt',
        prompt: 'a'.repeat(100),
        contextStrategy: strategy,
        maxContextTokens: 30,
      });

      const session = memory.getSession('session-1');
      expect(session).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // ReAct tool call loop
  // -------------------------------------------------------------------------
  describe('execute (ReAct tool call loop)', () => {
    let toolRegistry: ToolRegistry;
    let toolExecutor: ToolExecutor;

    const addTool: ITool<{ a: number; b: number }, number> = {
      name: 'add',
      description: 'Adds two numbers',
      parameters: {
        type: 'object',
        properties: {
          a: { type: 'number', description: 'First operand' },
          b: { type: 'number', description: 'Second operand' },
        },
        required: ['a', 'b'],
      },
      handler: async (args) => args.a + args.b,
    };

    beforeEach(() => {
      toolRegistry = new ToolRegistry(eventBus);
      toolExecutor = new ToolExecutor({ registry: toolRegistry, eventBus, logger });
      toolRegistry.registerTool(addTool);
    });

    it('should resolve a single tool call and return the final response', async () => {
      // First call → tool call; second call → final answer
      vi.spyOn(aiProvider, 'complete')
        .mockResolvedValueOnce(makeToolCallResponse('Calling add tool', 'add', { a: 3, b: 7 }, 'call-001'))
        .mockResolvedValueOnce(makeFinalResponse('The result is 10'));

      const toolExecutorWithSpy = new AgentExecutor({
        aiProvider,
        promptEngine,
        memory,
        eventBus,
        logger,
        toolExecutor,
      });

      const result = await toolExecutorWithSpy.execute({
        sessionId: 'tool-session',
        prompt: 'Add 3 and 7',
        tools: [addTool],
      });

      expect(result.response.content).toBe('The result is 10');
      expect(result.response.finishReason).toBe(FinishReason.STOP);
      expect(result.toolLoopsCompleted).toBe(1);

      // Memory should have: user, assistant (tool call), tool result, assistant (final)
      const session = memory.getSession('tool-session');
      expect(session?.messages).toHaveLength(4);
      expect(session?.messages[0].role).toBe(MessageRole.USER);
      expect(session?.messages[1].role).toBe(MessageRole.ASSISTANT); // tool-call assistant msg
      expect(session?.messages[2].role).toBe(MessageRole.TOOL);       // tool result
      expect(session?.messages[3].role).toBe(MessageRole.ASSISTANT);  // final answer
    });

    it('should emit TOOL_LOOP_STARTED and TOOL_LOOP_COMPLETED events', async () => {
      vi.spyOn(aiProvider, 'complete')
        .mockResolvedValueOnce(makeToolCallResponse('Using add', 'add', { a: 1, b: 2 }, 'call-002'))
        .mockResolvedValueOnce(makeFinalResponse('Result: 3'));

      const loopExecutor = new AgentExecutor({
        aiProvider,
        promptEngine,
        memory,
        eventBus,
        logger,
        toolExecutor,
      });

      const loopEvents: Event[] = [];
      eventBus.subscribe(AgentEvents.TOOL_LOOP_STARTED, (e) => loopEvents.push(e));
      eventBus.subscribe(AgentEvents.TOOL_LOOP_COMPLETED, (e) => loopEvents.push(e));

      await loopExecutor.execute({
        sessionId: 'events-session',
        prompt: 'Sum 1 and 2',
        tools: [addTool],
      });

      expect(loopEvents).toHaveLength(2);
      expect(loopEvents[0].type).toBe(AgentEvents.TOOL_LOOP_STARTED);
      expect(loopEvents[1].type).toBe(AgentEvents.TOOL_LOOP_COMPLETED);
    });

    it('should resolve multiple sequential tool loops', async () => {
      vi.spyOn(aiProvider, 'complete')
        .mockResolvedValueOnce(makeToolCallResponse('First call', 'add', { a: 1, b: 1 }, 'call-A'))
        .mockResolvedValueOnce(makeToolCallResponse('Second call', 'add', { a: 2, b: 2 }, 'call-B'))
        .mockResolvedValueOnce(makeFinalResponse('Done after two tools'));

      const multiLoopExecutor = new AgentExecutor({
        aiProvider,
        promptEngine,
        memory,
        eventBus,
        logger,
        toolExecutor,
      });

      const result = await multiLoopExecutor.execute({
        sessionId: 'multi-loop-session',
        prompt: 'Chain tool calls',
        tools: [addTool],
        maxToolLoops: 5,
      });

      expect(result.response.content).toBe('Done after two tools');
      expect(result.toolLoopsCompleted).toBe(2);
    });

    it('should throw AgentToolLoopError when maxToolLoops is exceeded', async () => {
      // Always return a tool call → infinite loop scenario
      vi.spyOn(aiProvider, 'complete').mockResolvedValue(
        makeToolCallResponse('Looping forever', 'add', { a: 1, b: 1 }, 'call-inf'),
      );

      const loopGuardExecutor = new AgentExecutor({
        aiProvider,
        promptEngine,
        memory,
        eventBus,
        logger,
        toolExecutor,
      });

      await expect(
        loopGuardExecutor.execute({
          sessionId: 'overflow-session',
          prompt: 'Overflow',
          tools: [addTool],
          maxToolLoops: 3,
        }),
      ).rejects.toThrow(AgentToolLoopError);
    });

    it('should include loop error details in thrown AgentToolLoopError', async () => {
      vi.spyOn(aiProvider, 'complete').mockResolvedValue(
        makeToolCallResponse('Still looping', 'add', { a: 0, b: 0 }, 'call-x'),
      );

      const loopGuardExecutor = new AgentExecutor({
        aiProvider,
        promptEngine,
        memory,
        eventBus,
        logger,
        toolExecutor,
      });

      let caughtError: AgentToolLoopError | undefined;
      try {
        await loopGuardExecutor.execute({
          sessionId: 'error-detail-session',
          prompt: 'Error details test',
          tools: [addTool],
          maxToolLoops: 2,
        });
      } catch (e) {
        if (e instanceof AgentToolLoopError) {
          caughtError = e;
        }
      }

      expect(caughtError).toBeDefined();
      expect(caughtError?.maxLoops).toBe(2);
      expect(caughtError?.sessionId).toBe('error-detail-session');
      expect(caughtError?.message).toContain('2 iterations');
    });

    it('should store tool result message with correct toolCallId in memory', async () => {
      vi.spyOn(aiProvider, 'complete')
        .mockResolvedValueOnce(makeToolCallResponse('Checking', 'add', { a: 5, b: 5 }, 'tc-99'))
        .mockResolvedValueOnce(makeFinalResponse('Answer is 10'));

      const resultExecutor = new AgentExecutor({
        aiProvider,
        promptEngine,
        memory,
        eventBus,
        logger,
        toolExecutor,
      });

      await resultExecutor.execute({
        sessionId: 'tool-id-session',
        prompt: 'Check tool call id',
        tools: [addTool],
      });

      const session = memory.getSession('tool-id-session');
      const toolMsg = session?.messages.find((m) => m.role === MessageRole.TOOL);
      expect(toolMsg).toBeDefined();
      expect(toolMsg?.toolCallId).toBe('tc-99');
    });

    it('should not enter tool loop if no toolExecutor is configured', async () => {
      // Even with a TOOL_CALLS response, without a toolExecutor it should treat it as final
      vi.spyOn(aiProvider, 'complete').mockResolvedValueOnce(
        makeToolCallResponse('Tool call no executor', 'add', { a: 1, b: 1 }, 'call-noexec'),
      );

      // Executor without toolExecutor configured
      const noToolExecExecutor = new AgentExecutor({
        aiProvider,
        promptEngine,
        memory,
        eventBus,
        logger,
      });

      const result = await noToolExecExecutor.execute({
        sessionId: 'no-exec-session',
        prompt: 'Tool call ignored',
      });

      // Should return the tool-call response as the final answer since no executor is set
      expect(result.toolLoopsCompleted).toBe(0);
      expect(result.response.finishReason).toBe(FinishReason.TOOL_CALLS);
    });
  });

  // -------------------------------------------------------------------------
  // Streaming (backward compat)
  // -------------------------------------------------------------------------
  describe('executeStream', () => {
    it('should stream response chunks token by token', async () => {
      const streamingProvider = new MockAIProvider();
      async function* mockStreamGenerator() {
        yield 'Hello ';
        yield 'streaming ';
        yield 'world!';
      }
      vi.spyOn(streamingProvider, 'stream').mockReturnValue(mockStreamGenerator());

      const streamExecutor = new AgentExecutor({
        aiProvider: streamingProvider,
        promptEngine,
        memory,
        eventBus,
        logger,
      });

      const tokens: string[] = [];
      const onToken = vi.fn((token: string) => tokens.push(token));

      const chunks: string[] = [];
      for await (const chunk of streamExecutor.executeStream({
        sessionId: 'stream-session',
        prompt: 'Stream request',
        onToken,
      })) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello ', 'streaming ', 'world!']);
      expect(tokens).toEqual(['Hello ', 'streaming ', 'world!']);
      expect(onToken).toHaveBeenCalledTimes(3);

      const session = memory.getSession('stream-session');
      expect(session?.messages).toHaveLength(2);
      expect(session?.messages[1].role).toBe(MessageRole.ASSISTANT);
      expect(session?.messages[1].content).toBe('Hello streaming world!');
    });

    it('should emit TOKEN_STREAMED events during streaming', async () => {
      const streamingProvider = new MockAIProvider();
      async function* mockStreamGenerator() {
        yield 'Chunk 1';
        yield 'Chunk 2';
      }
      vi.spyOn(streamingProvider, 'stream').mockReturnValue(mockStreamGenerator());

      const streamExecutor = new AgentExecutor({
        aiProvider: streamingProvider,
        promptEngine,
        memory,
        eventBus,
        logger,
      });

      const tokenEvents: Event[] = [];
      eventBus.subscribe(AgentEvents.TOKEN_STREAMED, (e) => tokenEvents.push(e));

      for await (const chunk of streamExecutor.executeStream({
        sessionId: 'stream-events-session',
        prompt: 'Stream events test',
      })) {
        void chunk;
      }

      expect(tokenEvents).toHaveLength(2);
      expect(tokenEvents[0].type).toBe(AgentEvents.TOKEN_STREAMED);
    });

    it('should throw AgentStreamError and emit EXECUTION_FAILED on stream error', async () => {
      const failingProvider = new MockAIProvider();
      async function* mockFailingStream() {
        yield 'First chunk';
        throw new Error('Stream interrupted');
      }
      vi.spyOn(failingProvider, 'stream').mockReturnValue(mockFailingStream());

      const failingExecutor = new AgentExecutor({
        aiProvider: failingProvider,
        promptEngine,
        memory,
        eventBus,
        logger,
      });

      const failedEvents: Event[] = [];
      eventBus.subscribe(AgentEvents.EXECUTION_FAILED, (e) => failedEvents.push(e));

      const consumeStream = async () => {
        for await (const chunk of failingExecutor.executeStream({
          sessionId: 'stream-fail-session',
          prompt: 'Stream failure test',
        })) {
          void chunk;
        }
      };

      await expect(consumeStream()).rejects.toThrow(AgentStreamError);
      expect(failedEvents).toHaveLength(1);
    });
  });
});

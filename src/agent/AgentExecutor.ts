import type { IAIProvider } from '../ai/IAIProvider.js';
import type { IPromptEngine } from '../prompt/IPromptEngine.js';
import type { IConversationMemory } from '../context/IConversationMemory.js';
import type { IContextWindowStrategy } from '../context/IContextWindowStrategy.js';
import type { IEventBus } from '../events/IEventBus.js';
import type { ILogger } from '../logging/ILogger.js';
import type { IToolExecutor } from '../tools/IToolExecutor.js';
import type { AIResponse } from '../ai/AIResponse.js';
import { systemMessage, userMessage, assistantMessage } from '../ai/AIMessage.js';
import { MessageRole } from '../ai/AIMessage.js';
import { FinishReason } from '../ai/AIResponse.js';
import type { IAgentExecutor, AgentExecuteOptions, AgentExecuteResult } from './IAgentExecutor.js';
import { AgentExecutionError, AgentStreamError, AgentToolLoopError } from './AgentError.js';
import { AgentEvents } from './AgentEvents.js';

/** Default maximum number of tool call loop iterations. */
const DEFAULT_MAX_TOOL_LOOPS = 5;

/**
 * Configuration options for AgentExecutor.
 */
export interface AgentExecutorConfig {
  readonly aiProvider: IAIProvider;
  readonly promptEngine: IPromptEngine;
  readonly memory: IConversationMemory;
  readonly eventBus?: IEventBus;
  readonly logger?: ILogger;
  readonly defaultContextStrategy?: IContextWindowStrategy;
  readonly defaultMaxContextTokens?: number;
  /**
   * Optional tool executor for resolving tool calls during the ReAct loop.
   * If omitted, tool call responses will be treated as final responses.
   */
  readonly toolExecutor?: IToolExecutor;
}

/**
 * Core Agent Executor implementation coordinating prompt engine, conversation memory,
 * AI provider requests, and an optional ReAct tool call loop with full lifecycle
 * event broadcasting and streaming support.
 */
export class AgentExecutor implements IAgentExecutor {
  private readonly aiProvider: IAIProvider;
  private readonly promptEngine: IPromptEngine;
  private readonly memory: IConversationMemory;
  private readonly eventBus?: IEventBus;
  private readonly logger?: ILogger;
  private readonly defaultContextStrategy?: IContextWindowStrategy;
  private readonly defaultMaxContextTokens?: number;
  private readonly toolExecutor?: IToolExecutor;

  constructor(
    configOrAiProvider: AgentExecutorConfig | IAIProvider,
    promptEngine?: IPromptEngine,
    memory?: IConversationMemory,
    eventBus?: IEventBus,
    logger?: ILogger,
  ) {
    if ('aiProvider' in configOrAiProvider) {
      this.aiProvider = configOrAiProvider.aiProvider;
      this.promptEngine = configOrAiProvider.promptEngine;
      this.memory = configOrAiProvider.memory;
      this.eventBus = configOrAiProvider.eventBus;
      this.logger = configOrAiProvider.logger;
      this.defaultContextStrategy = configOrAiProvider.defaultContextStrategy;
      this.defaultMaxContextTokens = configOrAiProvider.defaultMaxContextTokens;
      this.toolExecutor = configOrAiProvider.toolExecutor;
    } else {
      this.aiProvider = configOrAiProvider;
      this.promptEngine = promptEngine!;
      this.memory = memory!;
      this.eventBus = eventBus;
      this.logger = logger;
    }
  }

  /**
   * Executes a complete prompt-to-response turn, including multi-turn tool call
   * resolution via the ReAct loop when the AI provider returns TOOL_CALLS.
   */
  async execute(options: AgentExecuteOptions): Promise<AgentExecuteResult> {
    const startTime = Date.now();
    const {
      sessionId,
      prompt,
      systemPrompt,
      variables = {},
      completionOptions,
      contextStrategy,
      maxContextTokens,
      maxToolLoops = DEFAULT_MAX_TOOL_LOOPS,
    } = options;

    try {
      // 1. Prepare session
      this.ensureSession(sessionId);

      // 2. Handle System Prompt (only once per session)
      if (systemPrompt) {
        const renderedSystem = this.promptEngine.render(systemPrompt, { variables }).content;
        const currentSession = this.memory.getSession(sessionId);
        const hasSystemMsg = currentSession?.messages.some((m) => m.role === MessageRole.SYSTEM);
        if (!hasSystemMsg) {
          this.memory.addMessage(sessionId, systemMessage(renderedSystem));
        }
      }

      // 3. Render and add User Prompt
      const renderedUser = this.promptEngine.render(prompt, { variables }).content;
      this.memory.addMessage(sessionId, userMessage(renderedUser));

      // 4. Emit execution started event
      this.publishEvent(AgentEvents.EXECUTION_STARTED, {
        sessionId,
        prompt: renderedUser,
        timestamp: startTime,
      });
      this.logger?.info(`Agent execution started for session "${sessionId}"`);

      // 5. Context window trimming
      const strategy = contextStrategy ?? this.defaultContextStrategy;
      const maxTokens = maxContextTokens ?? this.defaultMaxContextTokens;

      const buildMessages = () => {
        let msgs = [...(this.memory.getSession(sessionId)?.messages ?? [])];
        if (strategy && maxTokens !== undefined) {
          const trimResult = strategy.trim(msgs, maxTokens);
          msgs = [...trimResult.messages];
        }
        return msgs;
      };

      // 6. ReAct loop: call provider, resolve any tool calls, repeat
      let response: AIResponse;
      let loopIteration = 0;
      const initialMessages = buildMessages();

      response = await this.aiProvider.complete(initialMessages, completionOptions);

      while (
        this.isToolCallResponse(response) &&
        this.toolExecutor !== undefined
      ) {
        if (loopIteration >= maxToolLoops) {
          throw new AgentToolLoopError(
            `Agent tool call loop exceeded maximum of ${maxToolLoops} iterations for session "${sessionId}"`,
            sessionId,
            maxToolLoops,
          );
        }

        loopIteration++;
        const toolCalls = response.toolCalls ?? [];

        this.publishEvent(AgentEvents.TOOL_LOOP_STARTED, {
          sessionId,
          loopIteration,
          toolCallCount: toolCalls.length,
          timestamp: Date.now(),
        });
        this.logger?.info(
          `Tool loop iteration ${loopIteration} started for session "${sessionId}" with ${toolCalls.length} call(s)`,
        );

        // Store the assistant's tool-calling message in memory
        this.memory.addMessage(sessionId, assistantMessage(response.content));

        // Execute each tool call and inject results into memory
        for (const toolCall of toolCalls) {
          const toolResult = await this.toolExecutor.execute({
            toolName: toolCall.name,
            args: toolCall.args as Record<string, unknown>,
            context: { toolCallId: toolCall.id },
          });

          const toolMsg = this.toolExecutor.formatAsToolMessage(toolCall.id, toolResult);
          this.memory.addMessage(sessionId, toolMsg);

          this.logger?.info(
            `Tool "${toolCall.name}" [${toolCall.id}] resolved ${toolResult.success ? 'successfully' : 'with error'}`,
          );
        }

        this.publishEvent(AgentEvents.TOOL_LOOP_COMPLETED, {
          sessionId,
          loopIteration,
          toolCallCount: toolCalls.length,
          timestamp: Date.now(),
        });

        // Build updated message list and call provider again
        const updatedMessages = buildMessages();
        response = await this.aiProvider.complete(updatedMessages, completionOptions);
      }

      // 7. Store final assistant response in memory
      this.memory.addMessage(sessionId, assistantMessage(response.content));

      const durationMs = Date.now() - startTime;

      // 8. Emit execution completed
      this.publishEvent(AgentEvents.EXECUTION_COMPLETED, {
        sessionId,
        responseContent: response.content,
        durationMs,
        timestamp: Date.now(),
      });
      this.logger?.info(`Agent execution completed for session "${sessionId}" in ${durationMs}ms`);

      return {
        sessionId,
        response,
        messages: Object.freeze(initialMessages),
        durationMs,
        toolLoopsCompleted: loopIteration,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger?.error(`Agent execution failed for session "${sessionId}": ${errorMsg}`);
      this.publishEvent(AgentEvents.EXECUTION_FAILED, {
        sessionId,
        error: errorMsg,
        timestamp: Date.now(),
      });

      if (error instanceof AgentExecutionError || error instanceof AgentToolLoopError) {
        throw error;
      }
      throw new AgentExecutionError(
        `Agent execution failed: ${errorMsg}`,
        sessionId,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Executes a streaming prompt-to-response turn, yielding token chunks.
   * Note: Streaming mode does not participate in the tool call loop.
   */
  async *executeStream(options: AgentExecuteOptions): AsyncIterable<string> {
    const startTime = Date.now();
    const { sessionId, prompt, systemPrompt, variables = {}, completionOptions, contextStrategy, maxContextTokens, onToken } = options;

    try {
      // 1. Prepare session
      this.ensureSession(sessionId);

      // 2. Handle System Prompt
      if (systemPrompt) {
        const renderedSystem = this.promptEngine.render(systemPrompt, { variables }).content;
        const currentSession = this.memory.getSession(sessionId);
        const hasSystemMsg = currentSession?.messages.some((m) => m.role === MessageRole.SYSTEM);
        if (!hasSystemMsg) {
          this.memory.addMessage(sessionId, systemMessage(renderedSystem));
        }
      }

      // 3. Render and add User Prompt
      const renderedUser = this.promptEngine.render(prompt, { variables }).content;
      this.memory.addMessage(sessionId, userMessage(renderedUser));

      // 4. Emit execution started event
      this.publishEvent(AgentEvents.EXECUTION_STARTED, {
        sessionId,
        prompt: renderedUser,
        timestamp: startTime,
      });
      this.logger?.info(`Agent streaming execution started for session "${sessionId}"`);

      // 5. Context window trimming
      let messages = [...(this.memory.getSession(sessionId)?.messages ?? [])];
      const strategy = contextStrategy ?? this.defaultContextStrategy;
      const maxTokens = maxContextTokens ?? this.defaultMaxContextTokens;

      if (strategy && maxTokens !== undefined) {
        const trimResult = strategy.trim(messages, maxTokens);
        messages = [...trimResult.messages];
      }

      // 6. Stream tokens from AI provider
      const streamIterable = this.aiProvider.stream(messages, completionOptions);
      let fullContent = '';

      for await (const chunk of streamIterable) {
        fullContent += chunk;

        if (onToken) {
          onToken(chunk);
        }

        this.publishEvent(AgentEvents.TOKEN_STREAMED, {
          sessionId,
          token: chunk,
          timestamp: Date.now(),
        });

        yield chunk;
      }

      // 7. Store assistant response in memory after stream completion
      this.memory.addMessage(sessionId, assistantMessage(fullContent));

      const durationMs = Date.now() - startTime;

      // 8. Emit execution completed
      this.publishEvent(AgentEvents.EXECUTION_COMPLETED, {
        sessionId,
        responseContent: fullContent,
        durationMs,
        timestamp: Date.now(),
      });
      this.logger?.info(`Agent stream completed for session "${sessionId}" in ${durationMs}ms`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger?.error(`Agent stream failed for session "${sessionId}": ${errorMsg}`);
      this.publishEvent(AgentEvents.EXECUTION_FAILED, {
        sessionId,
        error: errorMsg,
        timestamp: Date.now(),
      });

      if (error instanceof AgentStreamError) {
        throw error;
      }
      throw new AgentStreamError(
        `Agent stream failed: ${errorMsg}`,
        sessionId,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Determines whether an AIResponse contains pending tool calls to resolve.
   */
  private isToolCallResponse(response: AIResponse): boolean {
    return (
      response.finishReason === FinishReason.TOOL_CALLS ||
      (response.toolCalls !== undefined && response.toolCalls.length > 0)
    );
  }

  /**
   * Ensures a conversation session exists in memory.
   */
  private ensureSession(sessionId: string): void {
    const existing = this.memory.getSession(sessionId);
    if (!existing) {
      this.memory.createSession(sessionId);
    }
  }

  /**
   * Helper to publish events to the EventBus if configured.
   */
  private publishEvent<T>(type: string, payload: T): void {
    if (this.eventBus) {
      this.eventBus.publish({
        type,
        timestamp: Date.now(),
        payload,
      });
    }
  }
}

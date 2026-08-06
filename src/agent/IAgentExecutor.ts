import type { AIMessage } from '../ai/AIMessage.js';
import type { AIResponse } from '../ai/AIResponse.js';
import type { AICompletionOptions } from '../ai/IAIProvider.js';
import type { IPromptTemplate } from '../prompt/IPromptTemplate.js';
import type { IContextWindowStrategy } from '../context/IContextWindowStrategy.js';
import type { ITool } from '../tools/ITool.js';

/**
 * Options for executing an agent turn.
 */
export interface AgentExecuteOptions {
  /** Session ID for conversation memory. */
  readonly sessionId: string;
  /** User prompt text or template. */
  readonly prompt: string | IPromptTemplate;
  /** Optional system prompt text or template. */
  readonly systemPrompt?: string | IPromptTemplate;
  /** Variables for template substitution. */
  readonly variables?: Readonly<Record<string, unknown>>;
  /** AI completion parameters (e.g. model, maxTokens, temperature). */
  readonly completionOptions?: AICompletionOptions;
  /** Optional context window strategy override. */
  readonly contextStrategy?: IContextWindowStrategy;
  /** Maximum token allowance for context window. */
  readonly maxContextTokens?: number;
  /** Callback for streaming tokens. */
  readonly onToken?: (token: string) => void;
  /**
   * Optional array of tools available for this execution.
   * When provided, the agent will resolve tool calls via the injected IToolExecutor.
   */
  readonly tools?: readonly ITool[];
  /**
   * Maximum number of ReAct tool-call loop iterations before aborting.
   * Prevents infinite loops when the provider keeps requesting tool calls.
   * Defaults to 5 if not specified.
   */
  readonly maxToolLoops?: number;
}

/**
 * Result of an agent execution.
 */
export interface AgentExecuteResult {
  /** The session ID. */
  readonly sessionId: string;
  /** The final AI response. */
  readonly response: AIResponse;
  /** The full conversation messages passed to the provider. */
  readonly messages: readonly AIMessage[];
  /** Execution duration in milliseconds. */
  readonly durationMs: number;
  /** Number of tool call loop iterations completed (0 when no tool calls occurred). */
  readonly toolLoopsCompleted: number;
}

/**
 * Contract for the Agent Executor module.
 */
export interface IAgentExecutor {
  /**
   * Executes a complete prompt-to-response turn.
   * If the AI provider requests tool calls, the executor will resolve them
   * and iterate until a final response is reached or maxToolLoops is exceeded.
   */
  execute(options: AgentExecuteOptions): Promise<AgentExecuteResult>;

  /**
   * Executes a streaming prompt-to-response turn, returning an async iterable of tokens.
   * Note: Streaming mode does not support the tool call resolution loop.
   */
  executeStream(options: AgentExecuteOptions): AsyncIterable<string>;
}

import type { IAdvisor } from './IAdvisor.js';
import type { AdvisorPromptResult } from './IAdvisorPromptComposer.js';
import type { OrchestrationPlan, OrchestrationResult } from './IAdvisorOrchestrator.js';
import type { IConversationMemory, ConversationSession } from '../context/IConversationMemory.js';
import type { ITool } from '../tools/ITool.js';
import type { AIMessage } from '../ai/AIMessage.js';
import type { ToolAccessDecision, AdvisorToolScope } from './IAdvisorSecurityPolicy.js';

/**
 * Unique identifier for an advisor execution session.
 */
export type AdvisorSessionId = string;

/**
 * Options for creating an advisor execution session.
 */
export interface CreateAdvisorSessionOptions {
  /** Optional metadata for the session. */
  readonly metadata?: Readonly<Record<string, unknown>>;
  /** Advisor to execute in this session. */
  readonly advisor: IAdvisor;
  /** Initial context variables. */
  readonly initialContext?: Readonly<Record<string, unknown>>;
  /** Tools available to the advisor. */
  readonly tools?: readonly ITool[];
}

/**
 * Options for executing an advisor step.
 */
export interface ExecuteAdvisorStepOptions {
  /** User input or prompt for this step. */
  readonly input: string;
  /** Optional context snippets to include. */
  readonly contextSnippets?: readonly string[];
  /** Conversation history to include. */
  readonly conversationHistory?: readonly AIMessage[];
  /** Override the default max tokens. */
  readonly maxTokens?: number;
}

/**
 * Result of a single advisor execution step.
 */
export interface AdvisorStepResult {
  /** The session ID. */
  readonly sessionId: AdvisorSessionId;
  /** The composed prompt used. */
  readonly composedPrompt: AdvisorPromptResult;
  /** The AI response. */
  readonly response: string;
  /** Messages generated during this step. */
  readonly messages: readonly AIMessage[];
  /** Execution duration in milliseconds. */
  readonly durationMs: number;
  /** Whether the step completed successfully. */
  readonly success: boolean;
  /** Error message if failed. */
  readonly error?: string;
}

/**
 * Result of an advisor execution pipeline run.
 */
export interface AdvisorPipelineResult {
  /** The session ID. */
  readonly sessionId: AdvisorSessionId;
  /** All step results in order. */
  readonly stepResults: readonly AdvisorStepResult[];
  /** Final aggregated response. */
  readonly finalResponse: string;
  /** Total execution duration in milliseconds. */
  readonly totalDurationMs: number;
  /** Whether the pipeline completed successfully. */
  readonly success: boolean;
  /** Error message if pipeline failed. */
  readonly error?: string;
  /** The conversation session. */
  readonly conversationSession: ConversationSession;
}

/**
 * Configuration for the AdvisorExecutionPipeline.
 */
export interface AdvisorExecutionPipelineConfig {
  /** Conversation memory for storing session history. */
  readonly conversationMemory: IConversationMemory;
  /** Default tools available to all advisors. */
  readonly defaultTools?: readonly ITool[];
  /** Default maximum tokens for context window. */
  readonly defaultMaxTokens?: number;
}

/**
 * Contract for the Advisor Execution Pipeline.
 *
 * Integrates AdvisorOrchestrator, AdvisorPromptComposer, ConversationMemory,
 * and tool execution to provide a complete advisor session management system.
 */
export interface IAdvisorExecutionPipeline {
  /**
   * Creates a new advisor execution session.
   */
  createSession(options: CreateAdvisorSessionOptions): AdvisorSessionId;

  /**
   * Executes a single advisor step within a session.
   */
  executeStep(
    sessionId: AdvisorSessionId,
    options: ExecuteAdvisorStepOptions,
  ): Promise<AdvisorStepResult>;

  /**
   * Executes a full orchestration plan within a session.
   */
  executePlan(
    sessionId: AdvisorSessionId,
    plan: OrchestrationPlan,
  ): Promise<OrchestrationResult>;

  /**
   * Retrieves the conversation session for an advisor session.
   */
  getConversationSession(sessionId: AdvisorSessionId): ConversationSession | undefined;

  /**
   * Adds a message to an advisor session's conversation history.
   */
  addMessage(sessionId: AdvisorSessionId, message: AIMessage): void;

  /**
   * Clears the conversation history for an advisor session.
   */
  clearSession(sessionId: AdvisorSessionId): void;

  /**
   * Deletes an advisor execution session.
   */
  deleteSession(sessionId: AdvisorSessionId): void;

  /**
   * Returns all active advisor session IDs.
   */
  getActiveSessions(): readonly AdvisorSessionId[];

  /**
   * Returns the number of active sessions.
   */
  get activeSessionCount(): number;

  /**
   * Checks whether an advisor is allowed to use a specific tool.
   * @param sessionId The advisor session ID.
   * @param toolName The tool name to check.
   * @returns An immutable tool access decision.
   */
  checkToolAccess(sessionId: AdvisorSessionId, toolName: string): ToolAccessDecision;

  /**
   * Returns the scoped tool access for an advisor session.
   * @param sessionId The advisor session ID.
   * @returns An immutable advisor tool scope.
   */
  getToolScope(sessionId: AdvisorSessionId): AdvisorToolScope;
}
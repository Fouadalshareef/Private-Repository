/**
 * Lifecycle event constants for agent execution.
 */
export const AgentEvents = {
  /** Emitted when agent execution starts. */
  EXECUTION_STARTED: 'agent.execution.started',
  /** Emitted when a token is streamed during execution. */
  TOKEN_STREAMED: 'agent.token.streamed',
  /** Emitted when agent execution completes successfully. */
  EXECUTION_COMPLETED: 'agent.execution.completed',
  /** Emitted when agent execution encounters an error. */
  EXECUTION_FAILED: 'agent.execution.failed',
  /** Emitted when a tool call resolution loop iteration begins. */
  TOOL_LOOP_STARTED: 'agent.tool_loop.started',
  /** Emitted when a tool call resolution loop iteration completes. */
  TOOL_LOOP_COMPLETED: 'agent.tool_loop.completed',
} as const;

/**
 * Type representing agent event names.
 */
export type AgentEventName = typeof AgentEvents[keyof typeof AgentEvents];

/**
 * Event payload interfaces for agent events.
 */
export interface AgentExecutionStartedPayload {
  readonly sessionId: string;
  readonly prompt: string;
  readonly timestamp: number;
}

export interface AgentTokenStreamedPayload {
  readonly sessionId: string;
  readonly token: string;
  readonly timestamp: number;
}

export interface AgentExecutionCompletedPayload {
  readonly sessionId: string;
  readonly responseContent: string;
  readonly durationMs: number;
  readonly timestamp: number;
}

export interface AgentExecutionFailedPayload {
  readonly sessionId: string;
  readonly error: string;
  readonly timestamp: number;
}

export interface AgentToolLoopStartedPayload {
  readonly sessionId: string;
  readonly loopIteration: number;
  readonly toolCallCount: number;
  readonly timestamp: number;
}

export interface AgentToolLoopCompletedPayload {
  readonly sessionId: string;
  readonly loopIteration: number;
  readonly toolCallCount: number;
  readonly timestamp: number;
}

/**
 * Event name constants for tool lifecycle events.
 */
export const ToolEvents = {
  /** Emitted when a tool is registered. */
  TOOL_REGISTERED: 'tool.registered',
  /** Emitted when a tool is unregistered. */
  TOOL_UNREGISTERED: 'tool.unregistered',
  /** Emitted when tool execution starts. */
  TOOL_EXECUTING: 'tool.executing',
  /** Emitted when tool execution succeeds. */
  TOOL_EXECUTED: 'tool.executed',
  /** Emitted when tool execution fails or times out. */
  TOOL_FAILED: 'tool.failed',
} as const;

/**
 * Type representing tool event names.
 */
export type ToolEventName = typeof ToolEvents[keyof typeof ToolEvents];

/**
 * Event payload interfaces.
 */
export interface ToolRegisteredPayload {
  readonly toolName: string;
  readonly description: string;
  readonly timestamp: number;
}

export interface ToolUnregisteredPayload {
  readonly toolName: string;
  readonly timestamp: number;
}

export interface ToolExecutingPayload {
  readonly toolName: string;
  readonly toolCallId?: string;
  readonly args: Record<string, unknown>;
  readonly timestamp: number;
}

export interface ToolExecutedPayload {
  readonly toolName: string;
  readonly toolCallId?: string;
  readonly success: boolean;
  readonly executionTimeMs: number;
  readonly timestamp: number;
}

export interface ToolFailedPayload {
  readonly toolName: string;
  readonly toolCallId?: string;
  readonly error: string;
  readonly executionTimeMs: number;
  readonly timestamp: number;
}

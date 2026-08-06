import type { ToolResult, ToolExecutionContext } from './ITool.js';
import type { AIMessage } from '../ai/AIMessage.js';

/**
 * Options for executing a tool.
 */
export interface ToolExecuteOptions {
  /** The name of the tool to execute. */
  readonly toolName: string;
  /** Arguments to pass to the tool handler. */
  readonly args: Record<string, unknown>;
  /** Optional execution context. */
  readonly context?: ToolExecutionContext;
  /** Optional override for maximum execution timeout in milliseconds. */
  readonly timeoutMs?: number;
}

/**
 * Contract for executing tools safely.
 */
export interface IToolExecutor {
  /**
   * Executes a tool with error containment and timeout enforcement.
   */
  execute(options: ToolExecuteOptions): Promise<ToolResult>;

  /**
   * Formats a tool execution result into an AIMessage standard response compatible with LLMs.
   */
  formatAsToolMessage(toolCallId: string, result: ToolResult): AIMessage;
}

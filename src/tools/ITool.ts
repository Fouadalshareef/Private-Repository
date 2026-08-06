/**
 * JSON Schema property definition for tool parameters.
 */
export interface JSONSchemaProperty {
  /** Property data type. */
  readonly type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  /** Human-readable description of the parameter. */
  readonly description?: string;
  /** Enum values if restricted. */
  readonly enum?: readonly (string | number | boolean)[];
  /** Item schema if type is array. */
  readonly items?: JSONSchemaProperty;
  /** Property definitions if type is object. */
  readonly properties?: Readonly<Record<string, JSONSchemaProperty>>;
  /** Default value if optional. */
  readonly default?: unknown;
}

/**
 * Parameter schema for a tool adhering to JSON Schema object format.
 */
export interface ToolParameterSchema {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, JSONSchemaProperty>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
}

/**
 * Context passed to a tool during execution.
 */
export interface ToolExecutionContext {
  /** Unique ID for the tool invocation request. */
  readonly toolCallId?: string;
  /** Associated conversation session ID. */
  readonly sessionId?: string;
  /** Maximum execution timeout in milliseconds. */
  readonly timeoutMs?: number;
  /** Arbitrary execution metadata. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Standardized result structure from a tool execution.
 */
export interface ToolResult {
  /** Whether the tool executed successfully. */
  readonly success: boolean;
  /** Result payload if successful. */
  readonly output: unknown;
  /** Error message if failed. */
  readonly error?: string;
  /** Execution duration in milliseconds. */
  readonly executionTimeMs: number;
}

/**
 * Handler function signature for executing a tool.
 */
export type ToolHandler<TArgs = Record<string, unknown>, TResult = unknown> = (
  args: TArgs,
  context?: ToolExecutionContext,
) => Promise<TResult> | TResult;

/**
 * Contract defining a system tool executable by the AI platform.
 */
export interface ITool<TArgs = Record<string, unknown>, TResult = unknown> {
  /** Unique tool name identifier (e.g., 'file_read', 'ast_search'). */
  readonly name: string;
  /** Description of what the tool does for LLM prompt context inclusion. */
  readonly description: string;
  /** Parameter specification schema. */
  readonly parameters: ToolParameterSchema;
  /** Execution handler. */
  readonly handler: ToolHandler<TArgs, TResult>;
}

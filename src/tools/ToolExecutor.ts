import type { IToolExecutor, ToolExecuteOptions } from './IToolExecutor.js';
import type { ToolResult } from './ITool.js';
import type { IToolRegistry } from './IToolRegistry.js';
import type { IEventBus } from '../events/IEventBus.js';
import type { ILogger } from '../logging/ILogger.js';
import type { AIMessage } from '../ai/AIMessage.js';
import { toolMessage } from '../ai/AIMessage.js';
import { ToolTimeoutError } from './ToolError.js';
import { ToolEvents } from './ToolEvents.js';

/**
 * Configuration options for ToolExecutor.
 */
export interface ToolExecutorConfig {
  readonly registry: IToolRegistry;
  readonly eventBus?: IEventBus;
  readonly logger?: ILogger;
  readonly defaultTimeoutMs?: number;
}

/**
 * Core implementation for executing system tools safely with timeout enforcement
 * and failure containment.
 */
export class ToolExecutor implements IToolExecutor {
  private readonly registry: IToolRegistry;
  private readonly eventBus?: IEventBus;
  private readonly logger?: ILogger;
  private readonly defaultTimeoutMs: number;

  constructor(
    configOrRegistry: ToolExecutorConfig | IToolRegistry,
    eventBus?: IEventBus,
    logger?: ILogger,
    defaultTimeoutMs: number = 30000,
  ) {
    if ('registry' in configOrRegistry) {
      this.registry = configOrRegistry.registry;
      this.eventBus = configOrRegistry.eventBus;
      this.logger = configOrRegistry.logger;
      this.defaultTimeoutMs = configOrRegistry.defaultTimeoutMs ?? 30000;
    } else {
      this.registry = configOrRegistry;
      this.eventBus = eventBus;
      this.logger = logger;
      this.defaultTimeoutMs = defaultTimeoutMs;
    }
  }

  /**
   * Executes a tool with error containment and timeout enforcement.
   */
  async execute(options: ToolExecuteOptions): Promise<ToolResult> {
    const startTime = Date.now();
    const { toolName, args, context, timeoutMs } = options;
    const effectiveTimeout = timeoutMs ?? context?.timeoutMs ?? this.defaultTimeoutMs;

    // 1. Verify tool registration
    const tool = this.registry.getTool(toolName);
    if (!tool) {
      const errMsg = `Tool not found: "${toolName}"`;
      this.logger?.error(errMsg);
      this.publishEvent(ToolEvents.TOOL_FAILED, {
        toolName,
        toolCallId: context?.toolCallId,
        error: errMsg,
        executionTimeMs: Date.now() - startTime,
        timestamp: Date.now(),
      });
      return {
        success: false,
        output: null,
        error: errMsg,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 2. Broadcast executing event (always before validation failure so listeners see consistent pairs)
    this.publishEvent(ToolEvents.TOOL_EXECUTING, {
      toolName,
      toolCallId: context?.toolCallId,
      args,
      timestamp: startTime,
    });
    this.logger?.info(`Executing tool "${toolName}"...`);

    // 3. Validate tool arguments
    const validation = this.registry.validateArgs(toolName, args);
    if (!validation.valid) {
      const errMsg = `Validation failed for tool "${toolName}": ${validation.errors.join('; ')}`;
      this.logger?.error(errMsg);
      this.publishEvent(ToolEvents.TOOL_FAILED, {
        toolName,
        toolCallId: context?.toolCallId,
        error: errMsg,
        executionTimeMs: Date.now() - startTime,
        timestamp: Date.now(),
      });
      return {
        success: false,
        output: null,
        error: errMsg,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 4. Set up timeout guard
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new ToolTimeoutError(toolName, effectiveTimeout));
      }, effectiveTimeout);
    });

    try {
      const handlerPromise = Promise.resolve(tool.handler(args, context));
      const output = await Promise.race([handlerPromise, timeoutPromise]);

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      const executionTimeMs = Date.now() - startTime;
      this.publishEvent(ToolEvents.TOOL_EXECUTED, {
        toolName,
        toolCallId: context?.toolCallId,
        success: true,
        executionTimeMs,
        timestamp: Date.now(),
      });
      this.logger?.info(`Tool "${toolName}" executed successfully in ${executionTimeMs}ms`);

      return {
        success: true,
        output,
        executionTimeMs,
      };
    } catch (error) {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      const executionTimeMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.logger?.error(`Tool "${toolName}" execution failed: ${errorMsg}`);
      this.publishEvent(ToolEvents.TOOL_FAILED, {
        toolName,
        toolCallId: context?.toolCallId,
        error: errorMsg,
        executionTimeMs,
        timestamp: Date.now(),
      });

      return {
        success: false,
        output: null,
        error: errorMsg,
        executionTimeMs,
      };
    }
  }

  /**
   * Formats a tool execution result into an AIMessage.
   */
  formatAsToolMessage(toolCallId: string, result: ToolResult): AIMessage {
    const content = result.success
      ? (typeof result.output === 'string' ? result.output : JSON.stringify(result.output))
      : JSON.stringify({ error: result.error ?? 'Tool execution failed' });

    return toolMessage(content, toolCallId);
  }

  /**
   * Helper to publish event to EventBus if configured.
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

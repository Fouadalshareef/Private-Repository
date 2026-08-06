import type { ITool } from './ITool.js';

/**
 * Result of validating tool arguments against its parameter schema.
 */
export interface ToolValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Contract for managing and validating system tools.
 */
export interface IToolRegistry {
  /**
   * Registers a tool.
   * @throws {Error} If a tool with the same name is already registered.
   */
  registerTool(tool: ITool): void;

  /**
   * Unregisters a tool by name.
   * @returns true if tool was found and removed, false otherwise.
   */
  unregisterTool(name: string): boolean;

  /**
   * Retrieves a registered tool by name.
   */
  getTool(name: string): ITool | undefined;

  /**
   * Checks if a tool with the given name is registered.
   */
  hasTool(name: string): boolean;

  /**
   * Returns a read-only list of all registered tools.
   */
  getAllTools(): readonly ITool[];

  /**
   * Validates arguments for a tool against its parameter schema.
   */
  validateArgs(name: string, args: Record<string, unknown>): ToolValidationResult;

  /**
   * Total number of registered tools.
   */
  get toolCount(): number;
}

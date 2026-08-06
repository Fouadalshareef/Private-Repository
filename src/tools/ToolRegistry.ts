import type { ITool, JSONSchemaProperty } from './ITool.js';
import type { IToolRegistry, ToolValidationResult } from './IToolRegistry.js';
import type { IEventBus } from '../events/IEventBus.js';
import { ToolEvents } from './ToolEvents.js';

/**
 * Core implementation for managing and indexing system tools.
 */
export class ToolRegistry implements IToolRegistry {
  private readonly tools: Map<string, ITool> = new Map();
  private readonly eventBus?: IEventBus;

  constructor(eventBus?: IEventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Registers a tool.
   */
  registerTool(tool: ITool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name "${tool.name}" is already registered.`);
    }

    this.tools.set(tool.name, tool);

    if (this.eventBus) {
      this.eventBus.publish({
        type: ToolEvents.TOOL_REGISTERED,
        timestamp: Date.now(),
        payload: {
          toolName: tool.name,
          description: tool.description,
          timestamp: Date.now(),
        },
      });
    }
  }

  /**
   * Unregisters a tool by name.
   */
  unregisterTool(name: string): boolean {
    const existed = this.tools.delete(name);
    if (existed && this.eventBus) {
      this.eventBus.publish({
        type: ToolEvents.TOOL_UNREGISTERED,
        timestamp: Date.now(),
        payload: {
          toolName: name,
          timestamp: Date.now(),
        },
      });
    }
    return existed;
  }

  /**
   * Retrieves a registered tool by name.
   */
  getTool(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  /**
   * Checks if a tool with the given name is registered.
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Returns a read-only list of all registered tools.
   */
  getAllTools(): readonly ITool[] {
    return Object.freeze(Array.from(this.tools.values()));
  }

  /**
   * Validates arguments for a tool against its parameter schema.
   */
  validateArgs(name: string, args: Record<string, unknown>): ToolValidationResult {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        valid: false,
        errors: Object.freeze([`Tool "${name}" is not registered.`]),
      };
    }

    const errors: string[] = [];
    const schema = tool.parameters;

    // Check required properties
    if (schema.required) {
      for (const reqKey of schema.required) {
        if (!(reqKey in args) || args[reqKey] === undefined) {
          errors.push(`Missing required parameter "${reqKey}".`);
        }
      }
    }

    // Check individual parameter types and constraints
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in args && args[key] !== undefined) {
          const val = args[key];
          this.validateProperty(key, val, propSchema, errors);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: Object.freeze(errors),
    };
  }

  /**
   * Returns total number of registered tools.
   */
  get toolCount(): number {
    return this.tools.size;
  }

  /**
   * Internal helper to validate a single property value against property schema.
   */
  private validateProperty(key: string, val: unknown, schema: JSONSchemaProperty, errors: string[]): void {
    switch (schema.type) {
      case 'string':
        if (typeof val !== 'string') {
          errors.push(`Parameter "${key}" must be of type string, received ${typeof val}.`);
        }
        break;
      case 'number':
        if (typeof val !== 'number' || Number.isNaN(val)) {
          errors.push(`Parameter "${key}" must be of type number, received ${typeof val}.`);
        }
        break;
      case 'integer':
        if (typeof val !== 'number' || !Number.isInteger(val)) {
          errors.push(`Parameter "${key}" must be an integer, received ${val}.`);
        }
        break;
      case 'boolean':
        if (typeof val !== 'boolean') {
          errors.push(`Parameter "${key}" must be of type boolean, received ${typeof val}.`);
        }
        break;
      case 'array':
        if (!Array.isArray(val)) {
          errors.push(`Parameter "${key}" must be an array.`);
        }
        break;
      case 'object':
        if (typeof val !== 'object' || val === null || Array.isArray(val)) {
          errors.push(`Parameter "${key}" must be an object.`);
        }
        break;
    }

    if (schema.enum && schema.enum.length > 0) {
      if (!schema.enum.includes(val as string | number | boolean)) {
        errors.push(`Parameter "${key}" must be one of [${schema.enum.join(', ')}], received "${String(val)}".`);
      }
    }
  }
}

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../src/tools/ToolRegistry.js';
import { ToolExecutor } from '../src/tools/ToolExecutor.js';
import type { ITool } from '../src/tools/ITool.js';
import { EventBus } from '../src/events/EventBus.js';
import { Logger } from '../src/logging/Logger.js';
import { ToolEvents } from '../src/tools/ToolEvents.js';
import { MessageRole } from '../src/ai/AIMessage.js';
import type { Event } from '../src/events/EventTypes.js';

describe('ToolEngine', () => {
  let registry: ToolRegistry;
  let executor: ToolExecutor;
  let eventBus: EventBus;
  let logger: Logger;

  const sampleTool: ITool<{ a: number; b: number }, number> = {
    name: 'calculator_add',
    description: 'Adds two numbers together',
    parameters: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' },
      },
      required: ['a', 'b'],
    },
    handler: async (args) => args.a + args.b,
  };

  beforeEach(() => {
    eventBus = new EventBus();
    logger = new Logger();
    registry = new ToolRegistry(eventBus);
    executor = new ToolExecutor({
      registry,
      eventBus,
      logger,
    });
  });

  describe('ToolRegistry', () => {
    it('should register and retrieve a tool', () => {
      registry.registerTool(sampleTool);

      expect(registry.hasTool('calculator_add')).toBe(true);
      expect(registry.getTool('calculator_add')).toBe(sampleTool);
      expect(registry.toolCount).toBe(1);
    });

    it('should throw error when registering duplicate tool name', () => {
      registry.registerTool(sampleTool);

      expect(() => registry.registerTool(sampleTool)).toThrow('Tool with name "calculator_add" is already registered.');
    });

    it('should unregister a tool', () => {
      registry.registerTool(sampleTool);
      const unregistered = registry.unregisterTool('calculator_add');

      expect(unregistered).toBe(true);
      expect(registry.hasTool('calculator_add')).toBe(false);
      expect(registry.toolCount).toBe(0);
    });

    it('should list all registered tools', () => {
      registry.registerTool(sampleTool);
      const all = registry.getAllTools();

      expect(all).toHaveLength(1);
      expect(all[0].name).toBe('calculator_add');
    });

    it('should validate required parameters correctly', () => {
      registry.registerTool(sampleTool);

      const validRes = registry.validateArgs('calculator_add', { a: 5, b: 10 });
      expect(validRes.valid).toBe(true);
      expect(validRes.errors).toHaveLength(0);

      const invalidRes = registry.validateArgs('calculator_add', { a: 5 });
      expect(invalidRes.valid).toBe(false);
      expect(invalidRes.errors).toContain('Missing required parameter "b".');
    });

    it('should validate parameter types and enum constraints', () => {
      const enumTool: ITool<{ mode: string; count: number; active: boolean; items: string[]; data: Record<string, unknown> }> = {
        name: 'complex_tool',
        description: 'Tool with complex constraints',
        parameters: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['fast', 'slow'] },
            count: { type: 'integer' },
            active: { type: 'boolean' },
            items: { type: 'array' },
            data: { type: 'object' },
          },
          required: ['mode', 'count', 'active', 'items', 'data'],
        },
        handler: () => 'ok',
      };

      registry.registerTool(enumTool);

      const validRes = registry.validateArgs('complex_tool', {
        mode: 'fast',
        count: 10,
        active: true,
        items: ['a'],
        data: { key: 'val' },
      });
      expect(validRes.valid).toBe(true);

      const invalidRes = registry.validateArgs('complex_tool', {
        mode: 'invalid_mode',
        count: 10.5,
        active: 'true',
        items: 'not_an_array',
        data: 'not_an_object',
      });

      expect(invalidRes.valid).toBe(false);
      expect(invalidRes.errors.length).toBeGreaterThanOrEqual(4);
    });

    it('should emit TOOL_REGISTERED and TOOL_UNREGISTERED events', () => {
      const events: Event[] = [];
      eventBus.subscribe(ToolEvents.TOOL_REGISTERED, (e) => events.push(e));
      eventBus.subscribe(ToolEvents.TOOL_UNREGISTERED, (e) => events.push(e));

      registry.registerTool(sampleTool);
      registry.unregisterTool('calculator_add');

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe(ToolEvents.TOOL_REGISTERED);
      expect(events[1].type).toBe(ToolEvents.TOOL_UNREGISTERED);
    });
  });

  describe('ToolExecutor', () => {
    it('should execute a tool successfully', async () => {
      registry.registerTool(sampleTool);

      const result = await executor.execute({
        toolName: 'calculator_add',
        args: { a: 15, b: 25 },
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe(40);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should return failure result when executing non-existent tool', async () => {
      const result = await executor.execute({
        toolName: 'non_existent_tool',
        args: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool not found');
    });

    it('should return failure result when argument validation fails', async () => {
      registry.registerTool(sampleTool);

      const result = await executor.execute({
        toolName: 'calculator_add',
        args: { a: 'invalid_number', b: 10 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should catch handler exceptions and return failure result', async () => {
      const failingTool: ITool = {
        name: 'failing_tool',
        description: 'Always throws',
        parameters: { type: 'object', properties: {} },
        handler: () => {
          throw new Error('Tool failure inside handler');
        },
      };

      registry.registerTool(failingTool);

      const result = await executor.execute({
        toolName: 'failing_tool',
        args: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool failure inside handler');
    });

    it('should enforce execution timeout', async () => {
      const slowTool: ITool = {
        name: 'slow_tool',
        description: 'Takes too long',
        parameters: { type: 'object', properties: {} },
        handler: () => new Promise((resolve) => setTimeout(resolve, 200)),
      };

      registry.registerTool(slowTool);

      const result = await executor.execute({
        toolName: 'slow_tool',
        args: {},
        timeoutMs: 50,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out after 50ms');
    });

    it('should emit TOOL_EXECUTING, TOOL_EXECUTED, and TOOL_FAILED events', async () => {
      registry.registerTool(sampleTool);

      const events: Event[] = [];
      eventBus.subscribe(ToolEvents.TOOL_EXECUTING, (e) => events.push(e));
      eventBus.subscribe(ToolEvents.TOOL_EXECUTED, (e) => events.push(e));
      eventBus.subscribe(ToolEvents.TOOL_FAILED, (e) => events.push(e));

      await executor.execute({
        toolName: 'calculator_add',
        args: { a: 1, b: 2 },
      });

      await executor.execute({
        toolName: 'calculator_add',
        args: { a: 'bad' as unknown as number, b: 2 },
      });

      expect(events).toHaveLength(4); // EXECUTING, EXECUTED, EXECUTING, FAILED
      expect(events[0].type).toBe(ToolEvents.TOOL_EXECUTING);
      expect(events[1].type).toBe(ToolEvents.TOOL_EXECUTED);
      expect(events[2].type).toBe(ToolEvents.TOOL_EXECUTING);
      expect(events[3].type).toBe(ToolEvents.TOOL_FAILED);
    });

    it('should format tool result into standard AIMessage tool response', () => {
      const message = executor.formatAsToolMessage('call-123', {
        success: true,
        output: { result: 42 },
        executionTimeMs: 10,
      });

      expect(message.role).toBe(MessageRole.TOOL);
      expect(message.toolCallId).toBe('call-123');
      expect(message.content).toBe(JSON.stringify({ result: 42 }));
    });
  });
});

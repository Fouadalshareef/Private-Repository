import { describe, it, expect } from 'vitest';
import { AdvisorSecurityPolicy } from '../../src/advisors/AdvisorSecurityPolicy.js';
import { AdvisorCatalog } from '../../src/advisors/AdvisorCatalog.js';
import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import { ReadFileTool, WriteFileTool, DeleteFileTool, ListDirectoryTool, SearchWorkspaceTool, ExecuteCommandTool, SimulatedTerminal } from '../../src/tools/builtin/index.js';
import { VirtualFileSystem } from '../../src/filesystem/VirtualFileSystem.js';
import type { ITool } from '../../src/tools/ITool.js';
import { AdvisorFactory } from '../../src/advisors/AdvisorFactory.js';

function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  const fs = new VirtualFileSystem();
  fs.writeFile('/test.txt', 'hello');

  const tools: ITool[] = [
    new ReadFileTool(fs),
    new WriteFileTool(fs),
    new DeleteFileTool(fs),
    new ListDirectoryTool(fs),
    new SearchWorkspaceTool(fs),
    new ExecuteCommandTool(new SimulatedTerminal()),
  ];

  for (const tool of tools) {
    registry.registerTool(tool);
  }

  return registry;
}

describe('AdvisorSecurityPolicy', () => {
  let catalog: AdvisorCatalog;
  let registry: ToolRegistry;
  let policy: AdvisorSecurityPolicy;

  beforeEach(() => {
    catalog = new AdvisorCatalog();
    registry = createToolRegistry();
    policy = new AdvisorSecurityPolicy();
  });

  describe('resolveAllowedTools', () => {
    it('should return only tools matching advisor allowedTools patterns', () => {
      const advisor = catalog.get('software-engineer')!;
      const scope = policy.resolveAllowedTools(advisor, registry);
      const toolNames = scope.allowedTools.map((t) => t.name);
      expect(toolNames).toContain('fs.read_file');
      expect(toolNames).toContain('fs.write_file');
      expect(toolNames).toContain('fs.list_directory');
      expect(toolNames).not.toContain('workspace.search');
      expect(toolNames).not.toContain('terminal.execute');
    });

    it('should deny tools not in allowedTools list', () => {
      const advisor = catalog.get('security-advisor')!;
      const scope = policy.resolveAllowedTools(advisor, registry);
      const toolNames = scope.allowedTools.map((t) => t.name);
      expect(toolNames).not.toContain('terminal.execute');
      expect(toolNames).not.toContain('fs.write_file');
      expect(toolNames).not.toContain('fs.delete_file');
    });

    it('should return frozen AdvisorToolScope', () => {
      const advisor = catalog.get('frontend-engineer')!;
      const scope = policy.resolveAllowedTools(advisor, registry);
      expect(Object.isFrozen(scope)).toBe(true);
      expect(Object.isFrozen(scope.allowedTools)).toBe(true);
      expect(Object.isFrozen(scope.deniedTools)).toBe(true);
      expect(Object.isFrozen(scope.warnings)).toBe(true);
    });

    it('should include advisorId in scope', () => {
      const advisor = catalog.get('backend-engineer')!;
      const scope = policy.resolveAllowedTools(advisor, registry);
      expect(scope.advisorId).toBe('backend-engineer');
    });

    it('should support wildcard patterns', () => {
      const factory = new AdvisorFactory();
      const customAdvisor = factory.create({
        id: 'wildcard-advisor',
        profile: {
          name: 'Wildcard Tester',
          description: 'Tests wildcard matching',
          specialty: 'Wildcard testing',
          responsibilities: [],
          systemPrompt: 'Test wildcards',
          capabilities: [],
          allowedTools: ['fs.*'],
          metadata: {},
        },
      });
      const scope = policy.resolveAllowedTools(customAdvisor, registry);
      const toolNames = scope.allowedTools.map((t) => t.name);
      expect(toolNames).toContain('fs.read_file');
      expect(toolNames).toContain('fs.write_file');
      expect(toolNames).toContain('fs.delete_file');
      expect(toolNames).toContain('fs.list_directory');
    });

    it('should support question mark wildcard', () => {
      const factory = new AdvisorFactory();
      const customAdvisor = factory.create({
        id: 'wildcard-q',
        profile: {
          name: 'Question Mark Tester',
          description: 'Tests ? wildcard',
          specialty: 'Question mark testing',
          responsibilities: [],
          systemPrompt: 'Test ?',
          capabilities: [],
          allowedTools: ['fs.?ead_file'],
          metadata: {},
        },
      });
      const scope = policy.resolveAllowedTools(customAdvisor, registry);
      const toolNames = scope.allowedTools.map((t) => t.name);
      expect(toolNames).toContain('fs.read_file');
      expect(toolNames).not.toContain('fs.write_file');
    });

    it('should warn about unmatched patterns', () => {
      const factory = new AdvisorFactory();
      const customAdvisor = factory.create({
        id: 'warning-advisor',
        profile: {
          name: 'Warning Tester',
          description: 'Tests warnings',
          specialty: 'Warning testing',
          responsibilities: [],
          systemPrompt: 'Test warnings',
          capabilities: [],
          allowedTools: ['fs.read_file', 'nonexistent.tool'],
          metadata: {},
        },
      });
      const scope = policy.resolveAllowedTools(customAdvisor, registry);
      expect(scope.warnings.length).toBeGreaterThan(0);
      expect(scope.warnings.some((w) => w.includes('nonexistent.tool'))).toBe(true);
    });

    it('should use providedTools when registry is not provided', () => {
      const advisor = catalog.get('software-engineer')!;
      const customTools: ITool[] = [
        { name: 'custom.tool', description: 'Custom tool', parameters: { type: 'object', properties: {} }, handler: () => '' } as ITool,
      ];
      const scope = policy.resolveAllowedTools(advisor, undefined, customTools);
      expect(scope.allowedTools).toHaveLength(0);
      expect(scope.deniedTools).toContain('custom.tool');
    });
  });

  describe('checkAccess', () => {
    it('should allow access for permitted tools', () => {
      const advisor = catalog.get('software-engineer')!;
      const decision = policy.checkAccess(advisor, 'fs.read_file');
      expect(decision.allowed).toBe(true);
      expect(decision.toolName).toBe('fs.read_file');
      expect(decision.advisorId).toBe('software-engineer');
      expect(decision.matchedRule).toBe('read_file');
    });

    it('should deny access for forbidden tools', () => {
      const advisor = catalog.get('security-advisor')!;
      const decision = policy.checkAccess(advisor, 'fs.write_file');
      expect(decision.allowed).toBe(false);
      expect(decision.toolName).toBe('fs.write_file');
      expect(decision.advisorId).toBe('security-advisor');
      expect(decision.matchedRule).toBeUndefined();
    });

    it('should return frozen ToolAccessDecision', () => {
      const advisor = catalog.get('software-engineer')!;
      const decision = policy.checkAccess(advisor, 'fs.read_file');
      expect(Object.isFrozen(decision)).toBe(true);
    });

    it('should include reason in decision', () => {
      const advisor = catalog.get('software-engineer')!;
      const allowed = policy.checkAccess(advisor, 'fs.read_file');
      expect(allowed.reason).toContain('allowed');

      const securityAdvisor = catalog.get('security-advisor')!;
      const denied = policy.checkAccess(securityAdvisor, 'fs.write_file');
      expect(denied.reason).toContain('not in the allowed tools list');
    });
  });

  describe('getDeniedTools', () => {
    it('should return list of denied tool names', () => {
      const advisor = catalog.get('security-advisor')!;
      const denied = policy.getDeniedTools(advisor, registry);
      expect(denied).toContain('terminal.execute');
      expect(denied).toContain('fs.write_file');
      expect(denied).toContain('fs.delete_file');
    });

    it('should return frozen array', () => {
      const advisor = catalog.get('frontend-engineer')!;
      const denied = policy.getDeniedTools(advisor, registry);
      expect(Object.isFrozen(denied)).toBe(true);
    });
  });
});

describe('AdvisorSecurityPolicy integration with AdvisorExecutionPipeline', () => {
  it('should resolve allowed tools when creating a session', async () => {
    const { AdvisorExecutionPipeline } = await import('../../src/advisors/AdvisorExecutionPipeline.js');
    const { ConversationMemory } = await import('../../src/context/ConversationMemory.js');
    const { ContextWindowStrategy } = await import('../../src/context/ContextWindowStrategy.js');
    const { AdvisorPromptComposer } = await import('../../src/advisors/AdvisorPromptComposer.js');
    const { AdvisorOrchestrator } = await import('../../src/advisors/AdvisorOrchestrator.js');
    const { AdvisorCatalog } = await import('../../src/advisors/AdvisorCatalog.js');
    const { PromptEngine } = await import('../../src/prompt/PromptEngine.js');

    const catalog = new AdvisorCatalog();
    const registry = createToolRegistry();
    const strategy = new ContextWindowStrategy();
    const memory = new ConversationMemory(strategy, 4096);
    const promptEngine = new PromptEngine();
    const promptComposer = new AdvisorPromptComposer(promptEngine);
    const orchestrator = new AdvisorOrchestrator(catalog);
    const pipeline = new AdvisorExecutionPipeline({
      conversationMemory: memory,
      promptComposer,
      orchestrator,
      toolRegistry: registry,
    });

    const advisor = catalog.get('security-advisor')!;
    const sessionId = pipeline.createSession({
      advisor,
      metadata: { test: true },
    });

    const scope = pipeline.getToolScope(sessionId);
    const toolNames = scope.allowedTools.map((t) => t.name);
    expect(toolNames).not.toContain('terminal.execute');
    expect(toolNames).not.toContain('fs.write_file');
  });

  it('should check tool access for a session', async () => {
    const { AdvisorExecutionPipeline } = await import('../../src/advisors/AdvisorExecutionPipeline.js');
    const { ConversationMemory } = await import('../../src/context/ConversationMemory.js');
    const { ContextWindowStrategy } = await import('../../src/context/ContextWindowStrategy.js');
    const { AdvisorPromptComposer } = await import('../../src/advisors/AdvisorPromptComposer.js');
    const { AdvisorOrchestrator } = await import('../../src/advisors/AdvisorOrchestrator.js');
    const { AdvisorCatalog } = await import('../../src/advisors/AdvisorCatalog.js');
    const { PromptEngine } = await import('../../src/prompt/PromptEngine.js');

    const catalog = new AdvisorCatalog();
    const registry = createToolRegistry();
    const strategy = new ContextWindowStrategy();
    const memory = new ConversationMemory(strategy, 4096);
    const promptEngine = new PromptEngine();
    const promptComposer = new AdvisorPromptComposer(promptEngine);
    const orchestrator = new AdvisorOrchestrator(catalog);
    const pipeline = new AdvisorExecutionPipeline({
      conversationMemory: memory,
      promptComposer,
      orchestrator,
      toolRegistry: registry,
    });

    const advisor = catalog.get('software-engineer')!;
    const sessionId = pipeline.createSession({ advisor });

    const allowed = pipeline.checkToolAccess(sessionId, 'fs.read_file');
    expect(allowed.allowed).toBe(true);

    const denied = pipeline.checkToolAccess(sessionId, 'fs.delete_file');
    expect(denied.allowed).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Bootstrap } from '../../src/bootstrap/Bootstrap.js';
import { LogLevel } from '../../src/logging/LogLevel.js';
import { createCLIConfig } from '../../src/cli/CLIConfig.js';
import { CupawCLI } from '../../src/cli/CupawCLI.js';
import { AdvisorCatalog } from '../../src/advisors/AdvisorCatalog.js';
import { ContextRouter } from '../../src/advisors/ContextRouter.js';
import { AdvisorSecurityPolicy } from '../../src/advisors/AdvisorSecurityPolicy.js';
import { AdvisorExecutionPipeline } from '../../src/advisors/AdvisorExecutionPipeline.js';
import { AdvisorPromptComposer } from '../../src/advisors/AdvisorPromptComposer.js';
import { AdvisorOrchestrator } from '../../src/advisors/AdvisorOrchestrator.js';
import { ConversationMemory } from '../../src/context/ConversationMemory.js';
import { ContextWindowStrategy } from '../../src/context/ContextWindowStrategy.js';
import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import { ToolExecutor } from '../../src/tools/ToolExecutor.js';
import {
  ReadFileTool,
  WriteFileTool,
  DeleteFileTool,
  ListDirectoryTool,
  SearchWorkspaceTool,
  ExecuteCommandTool,
  SimulatedTerminal,
} from '../../src/tools/builtin/index.js';
import { VirtualFileSystem } from '../../src/filesystem/VirtualFileSystem.js';
import { PromptEngine } from '../../src/prompt/PromptEngine.js';
import type { ITool } from '../../src/tools/ITool.js';
import type { ToolAccessDecision, AdvisorToolScope } from '../../src/advisors/IAdvisorSecurityPolicy.js';

// Mock node:readline to avoid real stdin/stdout in tests
vi.mock('node:readline', () => {
  return {
    createInterface: vi.fn(() => {
      return {
        prompt: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
        setPrompt: vi.fn(),
      };
    }),
  };
});

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

function createTestConfig() {
  const bootstrap = new Bootstrap({ options: { logLevel: LogLevel.WARN } });
  const result = bootstrap.initialize();
  return createCLIConfig({
    configuration: result.configuration,
    logger: result.logger,
    eventBus: result.eventBus,
    container: result.container,
  });
}

describe('FullSystemE2E', () => {
  let catalog: AdvisorCatalog;
  let router: ContextRouter;
  let policy: AdvisorSecurityPolicy;
  let registry: ToolRegistry;

  beforeEach(() => {
    catalog = new AdvisorCatalog();
    router = new ContextRouter(catalog);
    policy = new AdvisorSecurityPolicy();
    registry = createToolRegistry();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('System bootstrap and module wiring', () => {
    it('should bootstrap all core modules without throwing', () => {
      const bootstrap = new Bootstrap({ options: { logLevel: LogLevel.WARN } });
      const result = bootstrap.initialize();

      expect(result.container).toBeDefined();
      expect(result.configuration).toBeDefined();
      expect(result.logger).toBeDefined();
      expect(result.eventBus).toBeDefined();
    });

    it('should wire CLI config with all subsystems', () => {
      const config = createTestConfig();

      expect(config.aiProvider).toBeDefined();
      expect(config.promptEngine).toBeDefined();
      expect(config.memory).toBeDefined();
      expect(config.toolRegistry).toBeDefined();
      expect(config.toolExecutor).toBeDefined();
      expect(config.sessionManager).toBeDefined();
      expect(config.authorizationEngine).toBeDefined();
      expect(config.agentExecutor).toBeDefined();
      expect(config.workspace).toBeDefined();
      expect(config.fileSystem).toBeDefined();
    });

    it('should register builtin tools in the tool registry', () => {
      const config = createTestConfig();

      const tools = config.toolRegistry.getAllTools();
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('fs.read_file');
      expect(toolNames).toContain('fs.write_file');
      expect(toolNames).toContain('fs.delete_file');
      expect(toolNames).toContain('fs.list_directory');
      expect(toolNames).toContain('workspace.search');
      expect(toolNames).toContain('terminal.execute');
    });
  });

  describe('End-to-end advisor flow with security scoping', () => {
    it('should complete full flow: route -> security check -> tool scope -> memory storage', async () => {
      // 1. Route a query to an advisor
      const routeResult = router.route({
        input: 'I need to review the code for security vulnerabilities',
        preferredAdvisorId: undefined,
      });

      expect(routeResult.advisor).toBeDefined();
      expect(routeResult.advisor?.profile.name).toBe('Security Advisor');

      const advisor = routeResult.advisor!;

      // 2. Check tool access via security policy
      const readDecision: ToolAccessDecision = policy.checkAccess(advisor, 'fs.read_file');
      const writeDecision: ToolAccessDecision = policy.checkAccess(advisor, 'fs.write_file');

      expect(readDecision.allowed).toBe(true);
      expect(writeDecision.allowed).toBe(false);
      expect(Object.isFrozen(readDecision)).toBe(true);
      expect(Object.isFrozen(writeDecision)).toBe(true);

      // 3. Resolve allowed tools
      const scope: AdvisorToolScope = policy.resolveAllowedTools(advisor, registry);
      expect(scope.allowedTools.length).toBeGreaterThan(0);
      expect(scope.deniedTools).toContain('terminal.execute');
      expect(Object.isFrozen(scope)).toBe(true);

      // 4. Create execution pipeline with security scoping
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

      // 5. Create session - tools should be scoped
      const sessionId = pipeline.createSession({
        advisor,
        metadata: { source: 'e2e-test' },
      });

      expect(sessionId).toBeDefined();

      // 6. Verify tool scope from pipeline
      const sessionScope = pipeline.getToolScope(sessionId);
      const toolNames = sessionScope.allowedTools.map((t) => t.name);
      expect(toolNames).not.toContain('terminal.execute');
      expect(Object.isFrozen(sessionScope)).toBe(true);

      // 7. Execute a step and store in memory
      const stepResult = await pipeline.executeStep(sessionId, {
        input: 'Review the security of the codebase',
      });

      expect(stepResult.success).toBe(true);
      expect(stepResult.sessionId).toBe(sessionId);
      expect(Object.isFrozen(stepResult)).toBe(true);

      // 8. Verify memory storage
      const conversationSession = pipeline.getConversationSession(sessionId);
      expect(conversationSession).toBeDefined();
      expect(conversationSession!.messages.length).toBeGreaterThan(0);
      expect(conversationSession!.messages[0].role).toBe('user');
      expect(conversationSession!.messages[1].role).toBe('assistant');
    });
  });

  describe('CLI advisor command integration', () => {
    it('should list advisors through CLI handler', async () => {
      const config = createTestConfig();
      const cli = new CupawCLI(config);

      // Access advisor handler via CLI internals for testing
      const advisorHandler = (cli as unknown as { advisorHandler: { listAdvisors: () => { advisors: { id: string; name: string; specialty: string; role: string }[] } } }).advisorHandler;

      const result = advisorHandler.listAdvisors();
      expect(result.advisors).toHaveLength(11);
      expect(result.advisors[0].id).toBe('chief-ai-architect');
      expect(Object.isFrozen(result.advisors[0])).toBe(true);
    });

    it('should route queries through CLI handler and return frozen output', async () => {
      const config = createTestConfig();
      const cli = new CupawCLI(config);
      const advisorHandler = (cli as unknown as { advisorHandler: { routeInput: (input: string) => { query: string; advisor: { id: string; name: string; specialty: string; role: string } | undefined; matchedBy: string | undefined; confidence: number; matchedKeywords: readonly string[] } } }).advisorHandler;

      const result = advisorHandler.routeInput('deploy the application to production');
      expect(result.advisor).toBeDefined();
      expect(result.advisor?.id).toBe('devops-engineer');
      expect(result.confidence).toBeGreaterThan(0);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.matchedKeywords)).toBe(true);
    });

    it('should switch advisor and return frozen output', async () => {
      const config = createTestConfig();
      const cli = new CupawCLI(config);
      const advisorHandler = (cli as unknown as { advisorHandler: { switchAdvisor: (id: string) => { advisorId: string | undefined; message: string }; getActiveAdvisorId: () => string | undefined } }).advisorHandler;

      const result = advisorHandler.switchAdvisor('software-engineer');
      expect(result.advisorId).toBe('software-engineer');
      expect(result.message).toContain('Software Engineer');
      expect(Object.isFrozen(result)).toBe(true);

      expect(advisorHandler.getActiveAdvisorId()).toBe('software-engineer');
    });
  });

  describe('Tool execution with security enforcement', () => {
    it('should execute allowed tools and deny forbidden tools', async () => {
      const executor = new ToolExecutor({
        registry,
        defaultTimeoutMs: 5000,
      });

      // Allowed tool for software engineer
      const allowedResult = await executor.execute({
        toolName: 'fs.read_file',
        args: { path: '/test.txt' },
      });

      expect(allowedResult.success).toBe(true);
      expect(allowedResult.output).toBe('hello');

      // Denied tool for security advisor - we check via policy, then executor should still work
      // because executor doesn't know about advisor scoping. The scoping happens at pipeline level.
      const securityAdvisor = catalog.get('security-advisor')!;
      const deniedDecision = policy.checkAccess(securityAdvisor, 'terminal.execute');
      expect(deniedDecision.allowed).toBe(false);
      expect(Object.isFrozen(deniedDecision)).toBe(true);
    });

    it('should enforce security scoping in advisor execution pipeline', async () => {
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

      const securityAdvisor = catalog.get('security-advisor')!;
      const sessionId = pipeline.createSession({ advisor: securityAdvisor });

      const scope = pipeline.getToolScope(sessionId);
      const toolNames = scope.allowedTools.map((t) => t.name);

      // Security advisor should not have write/delete/execute tools
      expect(toolNames).not.toContain('terminal.execute');
      expect(toolNames).not.toContain('fs.write_file');
      expect(toolNames).not.toContain('fs.delete_file');
      expect(Object.isFrozen(scope)).toBe(true);
    });
  });

  describe('Memory storage and conversation history', () => {
    it('should store advisor session messages in conversation memory', async () => {
      const strategy = new ContextWindowStrategy();
      const memory = new ConversationMemory(strategy, 4096);
      const promptEngine = new PromptEngine();
      const promptComposer = new AdvisorPromptComposer(promptEngine);
      const orchestrator = new AdvisorOrchestrator(catalog);
      const pipeline = new AdvisorExecutionPipeline({
        conversationMemory: memory,
        promptComposer,
        orchestrator,
      });

      const advisor = catalog.get('software-engineer')!;
      const sessionId = pipeline.createSession({ advisor });

      await pipeline.executeStep(sessionId, {
        input: 'Hello, I need help with a coding task',
      });

      const conversationSession = pipeline.getConversationSession(sessionId);
      expect(conversationSession).toBeDefined();
      expect(conversationSession!.messages.length).toBeGreaterThan(0);
      expect(conversationSession!.messages[0].role).toBe('user');
      expect(conversationSession!.messages[1].role).toBe('assistant');
      expect(Object.isFrozen(conversationSession!.messages)).toBe(true);
    });

    it('should maintain multi-turn conversation history', async () => {
      const strategy = new ContextWindowStrategy();
      const memory = new ConversationMemory(strategy, 4096);
      const promptEngine = new PromptEngine();
      const promptComposer = new AdvisorPromptComposer(promptEngine);
      const orchestrator = new AdvisorOrchestrator(catalog);
      const pipeline = new AdvisorExecutionPipeline({
        conversationMemory: memory,
        promptComposer,
        orchestrator,
      });

      const advisor = catalog.get('software-engineer')!;
      const sessionId = pipeline.createSession({ advisor });

      await pipeline.executeStep(sessionId, { input: 'First message' });
      await pipeline.executeStep(sessionId, { input: 'Second message' });
      await pipeline.executeStep(sessionId, { input: 'Third message' });

      const conversationSession = pipeline.getConversationSession(sessionId);
      expect(conversationSession!.messages.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Immutability guarantees', () => {
    it('should freeze all advisor security policy outputs', () => {
      const advisor = catalog.get('software-engineer')!;
      const decision = policy.checkAccess(advisor, 'fs.read_file');
      const scope = policy.resolveAllowedTools(advisor, registry);

      expect(Object.isFrozen(decision)).toBe(true);
      expect(Object.isFrozen(scope)).toBe(true);
      expect(Object.isFrozen(scope.allowedTools)).toBe(true);
      expect(Object.isFrozen(scope.deniedTools)).toBe(true);
      expect(Object.isFrozen(scope.warnings)).toBe(true);
    });

    it('should freeze all advisor execution pipeline outputs', async () => {
      const strategy = new ContextWindowStrategy();
      const memory = new ConversationMemory(strategy, 4096);
      const promptEngine = new PromptEngine();
      const promptComposer = new AdvisorPromptComposer(promptEngine);
      const orchestrator = new AdvisorOrchestrator(catalog);
      const pipeline = new AdvisorExecutionPipeline({
        conversationMemory: memory,
        promptComposer,
        orchestrator,
      });

      const advisor = catalog.get('software-engineer')!;
      const sessionId = pipeline.createSession({ advisor });

      const stepResult = await pipeline.executeStep(sessionId, {
        input: 'Test immutability',
      });

      expect(Object.isFrozen(stepResult)).toBe(true);
      expect(Object.isFrozen(stepResult.messages)).toBe(true);
    });

    it('should freeze all CLI advisor outputs', async () => {
      const config = createTestConfig();
      const cli = new CupawCLI(config);
      const advisorHandler = (cli as unknown as { advisorHandler: { listAdvisors: () => { advisors: { id: string; name: string; specialty: string; role: string }[] }; routeInput: (input: string) => { query: string; advisor: { id: string; name: string; specialty: string; role: string } | undefined; matchedBy: string | undefined; confidence: number; matchedKeywords: readonly string[] }; switchAdvisor: (id: string) => { advisorId: string | undefined; message: string } } }).advisorHandler;

      expect(Object.isFrozen(advisorHandler.listAdvisors())).toBe(true);
      expect(Object.isFrozen(advisorHandler.routeInput('test query'))).toBe(true);
      expect(Object.isFrozen(advisorHandler.switchAdvisor('software-engineer'))).toBe(true);
    });
  });

  describe('No memory leaks and session cleanup', () => {
    it('should create and clean up many advisor sessions without memory leaks', async () => {
      const strategy = new ContextWindowStrategy();
      const memory = new ConversationMemory(strategy, 4096);
      const promptEngine = new PromptEngine();
      const promptComposer = new AdvisorPromptComposer(promptEngine);
      const orchestrator = new AdvisorOrchestrator(catalog);
      const pipeline = new AdvisorExecutionPipeline({
        conversationMemory: memory,
        promptComposer,
        orchestrator,
      });

      const sessionIds: string[] = [];
      for (let i = 0; i < 50; i++) {
        const advisor = i % 2 === 0 ? catalog.get('software-engineer')! : catalog.get('security-advisor')!;
        const sessionId = pipeline.createSession({
          advisor,
          metadata: { iteration: i },
        });
        sessionIds.push(sessionId);
      }

      expect(pipeline.activeSessionCount).toBe(50);

      // Clean up all sessions
      for (const sessionId of sessionIds) {
        pipeline.deleteSession(sessionId);
      }

      expect(pipeline.activeSessionCount).toBe(0);
      expect(pipeline.getActiveSessions()).toHaveLength(0);
    });

    it('should not leak unhandled promise rejections during concurrent execution', async () => {
      const strategy = new ContextWindowStrategy();
      const memory = new ConversationMemory(strategy, 4096);
      const promptEngine = new PromptEngine();
      const promptComposer = new AdvisorPromptComposer(promptEngine);
      const orchestrator = new AdvisorOrchestrator(catalog);
      const pipeline = new AdvisorExecutionPipeline({
        conversationMemory: memory,
        promptComposer,
        orchestrator,
      });

      const advisor = catalog.get('software-engineer')!;
      const sessionId = pipeline.createSession({ advisor });

      // Execute multiple steps concurrently
      const promises = [
        pipeline.executeStep(sessionId, { input: 'Step 1' }),
        pipeline.executeStep(sessionId, { input: 'Step 2' }),
        pipeline.executeStep(sessionId, { input: 'Step 3' }),
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);

      // Verify no unhandled rejections occurred
      expect(pipeline.activeSessionCount).toBe(1);
    });
  });

  describe('ContextRouter integration with advisor pipeline', () => {
    it('should route queries to correct advisors and verify their tool scopes', async () => {
      const testCases = [
        { query: 'implement a new feature', expectedAdvisor: 'software-engineer' },
        { query: 'design a new UI component', expectedAdvisor: 'frontend-engineer' },
        { query: 'optimize database queries', expectedAdvisor: 'database-architect' },
        { query: 'set up CI/CD pipeline', expectedAdvisor: 'devops-engineer' },
        { query: 'check for security issues', expectedAdvisor: 'security-advisor' },
        { query: 'write tests for the project', expectedAdvisor: 'qa-engineer' },
      ];

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

      for (const testCase of testCases) {
        const routeResult = router.route({ input: testCase.query });
        expect(routeResult.advisor?.id).toBe(testCase.expectedAdvisor);

        const advisor = routeResult.advisor!;
        const sessionId = pipeline.createSession({ advisor });
        const scope = pipeline.getToolScope(sessionId);

        expect(scope.allowedTools.length).toBeGreaterThan(0);
        expect(Object.isFrozen(scope)).toBe(true);
      }
    });
  });

  describe('Full CLI to advisor pipeline simulation', () => {
    it('should simulate complete user journey from CLI input to advisor response', async () => {
      const config = createTestConfig();
      const cli = new CupawCLI(config);
      const advisorHandler = (cli as unknown as { advisorHandler: { routeInput: (input: string) => { query: string; advisor: { id: string; name: string; specialty: string; role: string } | undefined; matchedBy: string | undefined; confidence: number; matchedKeywords: readonly string[] }; switchAdvisor: (id: string) => { advisorId: string | undefined; message: string }; getActiveAdvisorId: () => string | undefined } }).advisorHandler;

      // Step 1: User asks a question
      const routeResult = advisorHandler.routeInput('deploy the application to Kubernetes');
      expect(routeResult.advisor?.id).toBe('devops-engineer');

      // Step 2: User switches to the recommended advisor
      const switchResult = advisorHandler.switchAdvisor(routeResult.advisor!.id);
      expect(switchResult.advisorId).toBe('devops-engineer');

      // Step 3: Verify active advisor
      expect(advisorHandler.getActiveAdvisorId()).toBe('devops-engineer');

      // Step 4: Execute a turn through the agent
      const turnResult = await (cli as unknown as { executeTurn: (prompt: string) => Promise<{ sessionId: string; response: string; streamed: boolean }> }).executeTurn('How do I set up a deployment pipeline?');
      expect(turnResult.sessionId).toBe('cli-session');
      expect(turnResult.response).toBeDefined();
      expect(typeof turnResult.response).toBe('string');

      // Step 5: Verify memory storage
      const session = config.memory.getSession('cli-session');
      expect(session).toBeDefined();
      expect(session!.messages.length).toBeGreaterThan(0);
    });

    it('should verify security scoping when switching advisors', async () => {
      const config = createTestConfig();
      const cli = new CupawCLI(config);
      const advisorHandler = (cli as unknown as { advisorHandler: { switchAdvisor: (id: string) => { advisorId: string | undefined; message: string }; getActiveAdvisorId: () => string | undefined } }).advisorHandler;

      // Switch to security advisor
      advisorHandler.switchAdvisor('security-advisor');

      const strategy = new ContextWindowStrategy();
      const memory = new ConversationMemory(strategy, 4096);
      const promptEngine = new PromptEngine();
      const promptComposer = new AdvisorPromptComposer(promptEngine);
      const orchestrator = new AdvisorOrchestrator(catalog);
      const pipeline = new AdvisorExecutionPipeline({
        conversationMemory: memory,
        promptComposer,
        orchestrator,
        toolRegistry: config.toolRegistry,
      });

      const advisor = catalog.get('security-advisor')!;
      const sessionId = pipeline.createSession({ advisor });

      const scope = pipeline.getToolScope(sessionId);
      const toolNames = scope.allowedTools.map((t) => t.name);

      // Security advisor should only have read/list/search tools
      expect(toolNames).toContain('fs.read_file');
      expect(toolNames).toContain('fs.list_directory');
      expect(toolNames).not.toContain('fs.write_file');
      expect(toolNames).not.toContain('terminal.execute');
    });
  });
});

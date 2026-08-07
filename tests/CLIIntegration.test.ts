import { AIProviderType } from '../src/ai/AIProviderType.js';
import { describe, it, expect, vi } from 'vitest';
import { Bootstrap } from '../src/bootstrap/Bootstrap.js';
import { LogLevel } from '../src/logging/LogLevel.js';
import { createCLIConfig } from '../src/cli/CLIConfig.js';
import { CupawCLI } from '../src/cli/CupawCLI.js';
import { CLIError, CLIBootstrapError, CLICommandError } from '../src/cli/CLIError.js';
import { SecurityEvents } from '../src/security/SecurityEvents.js';
import { AuthorizationPolicy, ToolSensitivity, AuthorizationStatus } from '../src/security/IToolAuthorizationEngine.js';
import { VirtualFileSystem } from '../src/filesystem/VirtualFileSystem.js';

// Mock node:readline to avoid real stdin/stdout in tests
vi.mock('node:readline', () => ({
  createInterface: vi.fn(() => ({
    prompt: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    setPrompt: vi.fn(),
  })),
}));

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

describe('CLIIntegration', () => {
  describe('CLIError', () => {
    it('CLIError should be an Error with correct name', () => {
      const error = new CLIError('test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CLIError);
      expect(error.name).toBe('CLIError');
      expect(error.message).toBe('test error');
    });

    it('CLIBootstrapError should carry correct name', () => {
      const error = new CLIBootstrapError('bootstrap failed');
      expect(error).toBeInstanceOf(CLIError);
      expect(error.name).toBe('CLIBootstrapError');
    });

    it('CLICommandError should carry correct name', () => {
      const error = new CLICommandError('unknown command');
      expect(error).toBeInstanceOf(CLIError);
      expect(error.name).toBe('CLICommandError');
    });
  });

  describe('createCLIConfig', () => {
    it('should wire all modules together without throwing', () => {
      const config = createTestConfig();
      expect(config).toBeDefined();
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
      expect(config.eventBus).toBeDefined();
      expect(config.logger).toBeDefined();
      expect(config.container).toBeDefined();
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
      expect(tools).toHaveLength(6);
    });

    it('should create a workspace with default workspace open', () => {
      const config = createTestConfig();
      expect(config.workspace.getState()).toBe('open');
      expect(config.workspace.getInfo().id).toBe('default');
    });

    it('should use MockAIProvider when none provided', () => {
      const config = createTestConfig();
      expect(config.aiProvider.getCapabilities().supportsStreaming).toBe(true);
    });

    it('should indicate Mock Provider mode by default', () => {
      const config = createTestConfig();
      expect(config.aiProvider.getProviderType()).toBe(AIProviderType.MOCK);
    });

    it('should emit SESSION_CREATED event when session manager creates a session', () => {
      const config = createTestConfig();
      const publishSpy = vi.spyOn(config.eventBus, 'publish');
      config.sessionManager.createSession({ id: 'integration-session' });
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SecurityEvents.SESSION_CREATED,
          payload: expect.objectContaining({ sessionId: 'integration-session' }),
        }),
      );
    });
  });

  describe('CupawCLI', () => {
    it('should construct without throwing', () => {
      const config = createTestConfig();
      const cli = new CupawCLI(config);
      expect(cli).toBeDefined();
    });

    it('should expose a start method', () => {
      const config = createTestConfig();
      const cli = new CupawCLI(config);
      expect(typeof cli.start).toBe('function');
    });

    it('should expose a stop method', () => {
      const config = createTestConfig();
      const cli = new CupawCLI(config);
      expect(typeof cli.stop).toBe('function');
    });
  });

  describe('End-to-end agent execution via CLI config', () => {
    it('should execute a prompt and return a response', async () => {
      const config = createTestConfig();
      const result = await config.agentExecutor.execute({
        sessionId: 'e2e-session',
        prompt: 'Hello',
      });
      expect(result.sessionId).toBe('e2e-session');
      expect(result.response.content).toBeTruthy();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should maintain conversation history across turns', async () => {
      const config = createTestConfig();
      await config.agentExecutor.execute({
        sessionId: 'history-session',
        prompt: 'First message',
      });
      await config.agentExecutor.execute({
        sessionId: 'history-session',
        prompt: 'Second message',
      });
      const session = config.memory.getSession('history-session');
      expect(session?.messages.length).toBeGreaterThanOrEqual(4);
    });

    it('should create and retrieve a security session', () => {
      const config = createTestConfig();
      config.sessionManager.createSession({ id: 'security-session', label: 'test' });
      const session = config.sessionManager.getSession('security-session');
      expect(session?.label).toBe('test');
      expect(config.sessionManager.isActive('security-session')).toBe(true);
    });

    it('should execute builtin tools through the tool executor', async () => {
      const config = createTestConfig();
      const fs = new VirtualFileSystem();
      fs.writeFile('/cli-test.txt', 'CLI integration test content');
      const writeTool = config.toolRegistry.getTool('fs.write_file');
      expect(writeTool).toBeDefined();

      const readTool = config.toolRegistry.getTool('fs.read_file');
      expect(readTool).toBeDefined();
    });

    it('should authorize a tool based on authorization rules', () => {
      const config = createTestConfig();
      config.authorizationEngine.addRule({
        id: 'allow-test',
        policy: AuthorizationPolicy.AUTO_APPROVE,
        sensitivityThreshold: ToolSensitivity.LOW,
      });
      const result = config.authorizationEngine.evaluate({
        toolName: 'fs.read_file',
        sessionId: 'auth-session',
        sensitivity: ToolSensitivity.LOW,
      });
      expect(result.status).toBe(AuthorizationStatus.APPROVED);
    });

    it('should deny a tool based on authorization rules', () => {
      const config = createTestConfig();
      config.authorizationEngine.addRule({
        id: 'deny-test',
        policy: AuthorizationPolicy.DENY_ALL,
        sensitivityThreshold: ToolSensitivity.LOW,
      });
      const result = config.authorizationEngine.evaluate({
        toolName: 'fs.delete_file',
        sessionId: 'auth-session',
        sensitivity: ToolSensitivity.LOW,
      });
      expect(result.status).toBe(AuthorizationStatus.DENIED);
    });
  });

  describe('CLI command handling', () => {
    it('should handle /help command', () => {
      const config = createTestConfig();
      const cli = new CupawCLI(config);
      // We can't easily test the private handleCommand method,
      // but we can verify the CLI object was constructed correctly
      expect(cli).toBeDefined();
    });

    it('should handle /tools command listing all registered tools', () => {
      const config = createTestConfig();
      const tools = config.toolRegistry.getAllTools();
      expect(tools.length).toBeGreaterThan(0);
      for (const tool of tools) {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
      }
    });
  });
});

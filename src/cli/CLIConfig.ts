import type { IConfiguration } from '../config/IConfiguration.js';
import type { DefaultConfigShape } from '../config/DefaultConfiguration.js';
import type { ILogger } from '../logging/ILogger.js';
import type { IAIProvider } from '../ai/IAIProvider.js';
import type { IPromptEngine } from '../prompt/IPromptEngine.js';
import type { IConversationMemory } from '../context/IConversationMemory.js';
import type { IContextWindowStrategy } from '../context/IContextWindowStrategy.js';
import type { IToolRegistry } from '../tools/IToolRegistry.js';
import type { IToolExecutor } from '../tools/IToolExecutor.js';
import type { ISessionManager } from '../security/ISessionManager.js';
import type { IToolAuthorizationEngine } from '../security/IToolAuthorizationEngine.js';
import type { IAgentExecutor } from '../agent/IAgentExecutor.js';
import type { IWorkspace } from '../workspace/IWorkspace.js';
import type { IFileSystem } from '../filesystem/IFileSystem.js';
import type { IEventBus } from '../events/IEventBus.js';
import { VirtualFileSystem } from '../filesystem/VirtualFileSystem.js';
import { Workspace } from '../workspace/Workspace.js';
import { PromptEngine } from '../prompt/PromptEngine.js';
import { ContextWindowStrategy } from '../context/ContextWindowStrategy.js';
import { ConversationMemory } from '../context/ConversationMemory.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import {
  ReadFileTool,
  WriteFileTool,
  DeleteFileTool,
  ListDirectoryTool,
  SearchWorkspaceTool,
  ExecuteCommandTool,
  SimulatedTerminal,
} from '../tools/builtin/index.js';
import { ToolExecutor } from '../tools/ToolExecutor.js';
import { SessionManager } from '../security/SessionManager.js';
import { ToolAuthorizationEngine } from '../security/ToolAuthorizationEngine.js';
import { MockAIProvider } from '../ai/MockAIProvider.js';
import { AgentExecutor } from '../agent/AgentExecutor.js';
import type { ITool } from '../tools/ITool.js';

/**
 * Configuration options for the Cupaw CLI application.
 */
export interface CLIConfig {
  /** The default AI provider to use for agent execution. */
  readonly aiProvider: IAIProvider;
  /** The prompt engine for rendering templates. */
  readonly promptEngine: IPromptEngine;
  /** The conversation memory for storing session history. */
  readonly memory: IConversationMemory;
  /** Optional context window strategy for trimming messages. */
  readonly contextStrategy?: IContextWindowStrategy;
  /** Optional maximum context window tokens. */
  readonly maxContextTokens?: number;
  /** The tool registry for managing system tools. */
  readonly toolRegistry: IToolRegistry;
  /** The tool executor for safely running tools. */
  readonly toolExecutor: IToolExecutor;
  /** The session manager for managing agent sessions. */
  readonly sessionManager: ISessionManager;
  /** The tool authorization engine for enforcing tool policies. */
  readonly authorizationEngine: IToolAuthorizationEngine;
  /** The agent executor for running agent execution cycles. */
  readonly agentExecutor: IAgentExecutor;
  /** The workspace for project context. */
  readonly workspace: IWorkspace;
  /** The virtual file system for file operations. */
  readonly fileSystem: IFileSystem;
  /** The event bus for lifecycle events. */
  readonly eventBus: IEventBus;
  /** The logger for structured logging. */
  readonly logger: ILogger;
  /** The DI container for resolving additional services. */
  readonly container: import('../core/container/IContainer.js').IContainer;
}

/**
 * Creates a CLI configuration by wiring all core modules together.
 *
 * This is the central integration point that connects the bootstrap
 * foundation with higher-level modules (AI, tools, sessions, agent).
 */
export function createCLIConfig(options: {
  readonly configuration: IConfiguration<DefaultConfigShape>;
  readonly logger: ILogger;
  readonly eventBus: IEventBus;
  readonly container: import('../core/container/IContainer.js').IContainer;
  readonly aiProvider?: IAIProvider;
  readonly maxContextTokens?: number;
}): CLIConfig {
  const {
    logger,
    eventBus,
    container,
    aiProvider,
    maxContextTokens,
  } = options;

  const resolvedMaxContextTokens = maxContextTokens ?? 4096;

  // 1. Create the virtual file system
  const fileSystem = new VirtualFileSystem();

  // 2. Create the workspace
  const workspace = new Workspace();
  workspace.create('default', 'Default Workspace', '/');
  workspace.open();

  // 3. Create the prompt engine
  const promptEngine = new PromptEngine();

  // 4. Create the conversation memory with context window strategy
  const contextStrategy = new ContextWindowStrategy();
  const memory = new ConversationMemory(contextStrategy, resolvedMaxContextTokens);

  // 5. Create the tool registry and register builtin tools
  const toolRegistry = new ToolRegistry(eventBus);

  const builtinTools: ITool[] = [
    new ReadFileTool(fileSystem),
    new WriteFileTool(fileSystem),
    new DeleteFileTool(fileSystem),
    new ListDirectoryTool(fileSystem),
    new SearchWorkspaceTool(fileSystem),
    new ExecuteCommandTool(new SimulatedTerminal()),
  ];

  for (const tool of builtinTools) {
    toolRegistry.registerTool(tool);
  }

  // 6. Create the tool executor
  const toolExecutor = new ToolExecutor({
    registry: toolRegistry,
    eventBus,
    logger,
    defaultTimeoutMs: 30000,
  });

  // 7. Create the session manager
  const sessionManager = new SessionManager({ eventBus, logger });

  // 8. Create the tool authorization engine
  const authorizationEngine = new ToolAuthorizationEngine({ eventBus, logger });

  // 9. Create the AI provider (use provided or mock)
  const resolvedAIProvider = aiProvider ?? new MockAIProvider({
    defaultResponse: 'Hello! I am the Cupaw AI assistant. How can I help you today?',
  });

  // 10. Create the agent executor
  const agentExecutor = new AgentExecutor({
    aiProvider: resolvedAIProvider,
    promptEngine,
    memory,
    eventBus,
    logger,
    defaultContextStrategy: contextStrategy,
    defaultMaxContextTokens: resolvedMaxContextTokens,
    toolExecutor,
  });

  return {
    aiProvider: resolvedAIProvider,
    promptEngine,
    memory,
    contextStrategy,
    maxContextTokens: resolvedMaxContextTokens,
    toolRegistry,
    toolExecutor,
    sessionManager,
    authorizationEngine,
    agentExecutor,
    workspace,
    fileSystem,
    eventBus,
    logger,
    container,
  };
}

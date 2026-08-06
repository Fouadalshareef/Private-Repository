import type { IAdvisor } from './IAdvisor.js';
import type { IAdvisorPromptComposer, AdvisorComposeContext, AdvisorPromptResult } from './IAdvisorPromptComposer.js';
import type { IAdvisorOrchestrator, OrchestrationPlan, OrchestrationResult } from './IAdvisorOrchestrator.js';
import type { IAdvisorExecutionPipeline, AdvisorSessionId, CreateAdvisorSessionOptions, ExecuteAdvisorStepOptions, AdvisorStepResult } from './IAdvisorExecutionPipeline.js';
import type { IConversationMemory, ConversationSession } from '../context/IConversationMemory.js';
import type { ITool } from '../tools/ITool.js';
import type { IToolRegistry } from '../tools/IToolRegistry.js';
import type { IAdvisorSecurityPolicy, ToolAccessDecision, AdvisorToolScope } from './IAdvisorSecurityPolicy.js';
import type { AIMessage } from '../ai/AIMessage.js';
import { MessageRole } from '../ai/AIMessage.js';
import { InvalidAdvisorSessionError } from './AdvisorError.js';
import { AdvisorSecurityPolicy } from './AdvisorSecurityPolicy.js';

/**
 * Internal session state for advisor execution.
 */
interface AdvisorSessionState {
  readonly sessionId: AdvisorSessionId;
  readonly advisor: IAdvisor;
  readonly tools: readonly ITool[];
  readonly context: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Concrete implementation of the Advisor Execution Pipeline.
 *
 * Integrates AdvisorOrchestrator, AdvisorPromptComposer, ConversationMemory,
 * and tool execution to provide complete advisor session management.
 */
export class AdvisorExecutionPipeline implements IAdvisorExecutionPipeline {
  private readonly conversationMemory: IConversationMemory;
  private readonly promptComposer: IAdvisorPromptComposer;
  private readonly orchestrator: IAdvisorOrchestrator;
  private readonly defaultTools: readonly ITool[];
  private readonly defaultMaxTokens: number | undefined;
  private readonly securityPolicy: IAdvisorSecurityPolicy;
  private readonly toolRegistry?: IToolRegistry;
  private readonly sessions: Map<AdvisorSessionId, AdvisorSessionState> = new Map();

  constructor(config: {
    conversationMemory: IConversationMemory;
    promptComposer: IAdvisorPromptComposer;
    orchestrator: IAdvisorOrchestrator;
    defaultTools?: readonly ITool[];
    defaultMaxTokens?: number;
    toolRegistry?: IToolRegistry;
  }) {
    this.conversationMemory = config.conversationMemory;
    this.promptComposer = config.promptComposer;
    this.orchestrator = config.orchestrator;
    this.defaultTools = Object.freeze([...(config.defaultTools ?? [])]);
    this.defaultMaxTokens = config.defaultMaxTokens;
    this.toolRegistry = config.toolRegistry;
    this.securityPolicy = new AdvisorSecurityPolicy();
  }

  /**
   * Creates a new advisor execution session.
   */
  createSession(options: CreateAdvisorSessionOptions): AdvisorSessionId {
    const sessionId = this.generateSessionId(options.advisor);

    // Create conversation session
    this.conversationMemory.createSession(sessionId, {
      metadata: options.metadata,
    });

    // Resolve allowed tools using security policy
    const providedTools = options.tools ?? this.defaultTools;
    const resolvedTools = this.resolveAllowedToolsForAdvisor(options.advisor, providedTools);

    // Store advisor session state
    const state: AdvisorSessionState = {
      sessionId,
      advisor: options.advisor,
      tools: resolvedTools,
      context: Object.freeze({ ...(options.initialContext ?? {}) }),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(sessionId, state);
    return sessionId;
  }

  /**
   * Executes a single advisor step within a session.
   */
  async executeStep(
    sessionId: AdvisorSessionId,
    options: ExecuteAdvisorStepOptions,
  ): Promise<AdvisorStepResult> {
    const state = this.getSessionState(sessionId);
    const startTime = Date.now();

    try {
      // Compose the prompt
      const composeContext: AdvisorComposeContext = {
        userInput: options.input,
        contextSnippets: options.contextSnippets,
        variables: state.context,
        maxTokens: options.maxTokens ?? this.defaultMaxTokens,
      };

      const composedPrompt = this.promptComposer.compose(state.advisor, composeContext);

      // Build orchestration plan for single step
      const plan: OrchestrationPlan = {
        id: `plan-${sessionId}-${Date.now()}`,
        name: `Advisor step for ${state.advisor.id}`,
        steps: [
          {
            id: `step-${Date.now()}`,
            advisorId: state.advisor.id,
            strategy: 'sequential',
            input: options.input,
            metadata: options.contextSnippets
              ? { contextSnippets: options.contextSnippets.join('\n') }
              : undefined,
          },
        ],
      };

      // Execute via orchestrator
      const result = this.orchestrator.execute(plan);

      // Extract response from result
      const response = result.stepResults[0]?.output ?? '';

      // Add user message to conversation
      const userMessage: AIMessage = {
        role: MessageRole.USER,
        content: options.input,
      };

      // Add assistant response to conversation
      const assistantMessage: AIMessage = {
        role: MessageRole.ASSISTANT,
        content: response,
      };

      this.conversationMemory.addMessages(sessionId, [userMessage, assistantMessage]);

      const durationMs = Date.now() - startTime;

      const stepResult: AdvisorStepResult = {
        sessionId,
        composedPrompt,
        response,
        messages: Object.freeze([userMessage, assistantMessage]),
        durationMs,
        success: result.success,
      };

      return Object.freeze(stepResult);
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const stepResult: AdvisorStepResult = {
        sessionId,
        composedPrompt: {
          advisorId: state.advisor.id,
          promptResult: {
            messages: [],
            tokenCount: 0,
            truncated: false,
          },
          systemPrompt: '',
          tokenBreakdown: {
            systemPrompt: 0,
            userInput: 0,
            contextSnippets: 0,
            conversationHistory: 0,
            total: 0,
          },
        } as AdvisorPromptResult,
        response: '',
        messages: Object.freeze([]),
        durationMs,
        success: false,
        error: errorMessage,
      };

      return Object.freeze(stepResult);
    }
  }

  /**
   * Executes a full orchestration plan within a session.
   */
  async executePlan(
    sessionId: AdvisorSessionId,
    plan: OrchestrationPlan,
  ): Promise<OrchestrationResult> {
    // Validate session exists
    this.getSessionState(sessionId);

    // Enhance plan steps with conversation context
    const enhancedSteps = plan.steps.map((step) => ({
      ...step,
    }));

    const enhancedPlan: OrchestrationPlan = {
      ...plan,
      steps: Object.freeze([...enhancedSteps]),
    };

    return this.orchestrator.execute(enhancedPlan);
  }

  /**
   * Retrieves the conversation session for an advisor session.
   */
  getConversationSession(sessionId: AdvisorSessionId): ConversationSession | undefined {
    return this.conversationMemory.getSession(sessionId);
  }

  /**
   * Adds a message to an advisor session's conversation history.
   */
  addMessage(sessionId: AdvisorSessionId, message: AIMessage): void {
    this.conversationMemory.addMessage(sessionId, message);
  }

  /**
   * Clears the conversation history for an advisor session.
   */
  clearSession(sessionId: AdvisorSessionId): void {
    this.conversationMemory.clearSession(sessionId);
  }

  /**
   * Deletes an advisor execution session.
   */
  deleteSession(sessionId: AdvisorSessionId): void {
    this.conversationMemory.deleteSession(sessionId);
    this.sessions.delete(sessionId);
  }

  /**
   * Returns all active advisor session IDs.
   */
  getActiveSessions(): readonly AdvisorSessionId[] {
    return Object.freeze(Array.from(this.sessions.keys()));
  }

  /**
   * Returns the number of active sessions.
   */
  get activeSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Checks whether an advisor is allowed to use a specific tool.
   */
  public checkToolAccess(sessionId: AdvisorSessionId, toolName: string): ToolAccessDecision {
    const state = this.getSessionState(sessionId);
    return this.securityPolicy.checkAccess(state.advisor, toolName);
  }

  /**
   * Returns the scoped tool access for an advisor session.
   */
  public getToolScope(sessionId: AdvisorSessionId): AdvisorToolScope {
    const state = this.getSessionState(sessionId);
    const scope = this.securityPolicy.resolveAllowedTools(state.advisor, this.toolRegistry ?? {
      getAllTools: () => state.tools,
      getTool: () => undefined,
      hasTool: () => false,
      registerTool: () => {},
      unregisterTool: () => false,
      validateArgs: () => ({ valid: false, errors: [] }),
      toolCount: 0,
    }, state.tools);
    return scope;
  }

  /**
   * Gets the session state or throws if not found.
   */
  private getSessionState(sessionId: AdvisorSessionId): AdvisorSessionState {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new InvalidAdvisorSessionError(sessionId);
    }
    return state;
  }

  /**
   * Generates a unique session ID.
   */
  private generateSessionId(advisor: IAdvisor): AdvisorSessionId {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `advisor-${advisor.id}-${timestamp}-${random}`;
  }

  /**
   * Resolves allowed tools for an advisor using the security policy.
   */
  private resolveAllowedToolsForAdvisor(advisor: IAdvisor, providedTools: readonly ITool[]): readonly ITool[] {
    if (!this.toolRegistry) {
      return Object.freeze([...providedTools]);
    }

    const toolsToCheck = providedTools.length > 0 ? providedTools : this.toolRegistry.getAllTools();
    const scope = this.securityPolicy.resolveAllowedTools(advisor, this.toolRegistry, toolsToCheck);
    return scope.allowedTools;
  }
}

import { MessageBus } from './message-bus.js';
import type { IEventBus } from '../events/IEventBus.js';
import type { AgentRuntime } from '../agent/agent-runtime.js';
import type { MemoryBundle } from '../memory/types.js';
import type { IToolRegistry } from '../tools/IToolRegistry.js';

import type {
  AgentRole,
  RoleAssignmentConfig,
  OrchestratorConfig,
  TaskStatus,
  OrchestrationResult,
  AgentTaskContext,
  AgentTaskResult,
} from './types.js';

const enum CommandType {
  Chat = 'chat',
  AgentExecute = 'agent.execute',
  PlannerPlan = 'planner.plan',
  OrchestratorRun = 'orchestrator.run',
  SessionList = 'session.list',
  SessionInfo = 'session.info',
  SessionClear = 'session.clear',
  AdvisorList = 'advisor.list',
  ToolList = 'tool.list',
  SystemStatus = 'system.status',
}

/**
 * Multi-Agent Orchestration Engine
 *
 * Coordinates specialized agents (Planner, Coder, Reviewer, Tester) for complex tasks.
 * Provides unified messaging, role management, and conflict resolution.
 */
export class AgentOrchestrator {
  private readonly messageBus: MessageBus;
  private readonly eventBus: IEventBus;
  private readonly agentRuntime: AgentRuntime | undefined;
  private readonly memory: MemoryBundle | undefined;
  private readonly toolRegistry: IToolRegistry | undefined;
  private readonly config: OrchestratorConfig;
  private readonly activeWorkflows: Map<string, OrchestrationResult> = new Map();

  constructor(
    config: OrchestratorConfig & {
      messageBus: MessageBus;
      eventBus: IEventBus;
      agentRuntime?: AgentRuntime;
      memory?: MemoryBundle;
      toolRegistry?: IToolRegistry;
    }
  ) {
    this.messageBus = config.messageBus!;
    this.eventBus = config.eventBus;
    this.agentRuntime = config.agentRuntime;
    this.memory = config.memory;
    this.toolRegistry = config.toolRegistry;
    this.config = config;

    this.setupSubscriptions();
  }

  /**
   * Sets up subscriptions to core events for orchestration coordination.
   */
  private setupSubscriptions(): void {
    this.eventBus.subscribe('agent.execution.completed', (data: any) => {
      this.messageBus.publish('agent.completed', data);
      this.handleAgentCompletion(data);
    });
  }

  /**
   * Registers a role configuration for an agent.
   */
  registerRole(config: RoleAssignmentConfig): void {
    this.messageBus.publish('role.assigned', config);
  }

  /**
   * Lists all registered roles.
   */
  listRoles(): readonly RoleAssignmentConfig[] {
    const roles = Array.from((this.messageBus as any).getAllRoles?.() ?? []);
    return roles;
  }

  /**
   * Plans a task tree from a natural language prompt.
   * Returns the task DAG with dependencies.
   */
  async planTask(prompt: string): Promise<{ rootId: string; nodes: any[] }> {
    const rootId = `task-${Date.now()}`;

    // Create initial task node
    const taskTree = {
      rootId,
      nodes: [
        {
          id: rootId,
          description: prompt,
          status: TaskStatus.Pending,
          dependencies: [],
          assignedAgent: undefined,
          result: undefined,
          error: undefined,
        },
      ],
    };

    this.eventBus.publish('planner.tasktree.created', { taskTree });
    return taskTree;
  }

  /**
   * Runs an orchestration workflow with the given configuration.
   */
  async runOrchestration(config: {
    workflowName: string;
    agents: readonly { agentId: string; role: AgentRole }[];
    task: string;
  }): Promise<OrchestrationResult> {
    const workflowId = `workflow-${Date.now()}`;

    this.eventBus.publish('orchestrator.started', {
      workflowId,
      workflowName: config.workflowName,
      agents: Array.from(config.agents),
    });

    try {
      const result = await this.executeWorkflow(workflowId, config);

      this.activeWorkflows.set(workflowId, result);
      this.eventBus.publish('orchestrator.completed', {
        workflowId,
        result,
      });

      return result;
    } catch (error) {
      const failedResult: OrchestrationResult = {
        workflowId,
        status: 'failed',
        errors: [error instanceof Error ? error.message : String(error)],
        taskResults: [],
        durationMs: Date.now() - parseInt(workflowId.split('-')[1] || '0'),
      };

      this.eventBus.publish('orchestrator.failed', {
        workflowId,
        error,
      });

      return failedResult;
    }
  }

  /**
   * Executes a workflow by coordinating agents sequentially.
   */
  private async executeWorkflow(
    workflowId: string,
    config: {
      workflowName: string;
      agents: readonly { agentId: string; role: AgentRole }[];
      task: string;
    }
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const taskResults: AgentTaskResult[] = [];

    // Execute role-based agent sequence
    for (const { agentId, role } of config.agents) {
      this.eventBus.publish('orchestrator.progress', {
        workflowId,
        agentId,
        role,
        status: 'in_progress',
      });

      try {
        const result = await this.executeAgentTask(agentId, role, config.task);
        taskResults.push(result);

        this.eventBus.publish('orchestrator.progress', {
          workflowId,
          agentId,
          role,
          status: 'completed',
        });
      } catch (error) {
        this.eventBus.publish('orchestrator.progress', {
          workflowId,
          agentId,
          role,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    return {
      workflowId,
      status: 'completed',
      finalOutput: taskResults[taskResults.length - 1]?.output,
      errors: [],
      taskResults,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Executes a task with an agent.
   */
  private async executeAgentTask(
    agentId: string,
    role: AgentRole,
    taskDescription: string
  ): Promise<AgentTaskResult> {
    const context: AgentTaskContext = {
      taskId: `task-${Date.now()}`,
      role,
      input: taskDescription,
      dependencies: [],
      memorySnapshot: this.memory,
    };

    if (!this.agentRuntime) {
      throw new Error('Agent runtime not initialized');
    }

    const result = await this.agentRuntime.executeAgent(agentId, context);

    return {
      taskId: context.taskId,
      success: true,
      output: result,
      error: undefined,
      nextRole: this.determineNextRole(role),
    };
  }

  /**
   * Determines the next role based on the current role in the workflow.
   */
  private determineNextRole(currentRole: AgentRole): AgentRole | undefined {
    const roleSequence: Partial<Record<AgentRole, AgentRole>> = {
      [AgentRole.Planner]: AgentRole.Coder,
      [AgentRole.Coder]: AgentRole.Tester,
      [AgentRole.Tester]: AgentRole.Reviewer,
    };

    return roleSequence[currentRole];
  }

  /**
   * Handles agent completion events.
   */
  private handleAgentCompletion(data: any): void {
    this.eventBus.publish('agent.lifecycle.completed', data);
  }
}

// Re-export types for convenience
export type {
  AgentRole,
  RoleAssignmentConfig,
  TaskStatus,
  OrchestrationResult,
  AgentTaskResult,
  AgentTaskContext,
  OrchestratorConfig,
};
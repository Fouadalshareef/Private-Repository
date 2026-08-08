import type { IEventBus } from '../events/IEventBus.js';
import type { MemoryBundle } from '../memory/types.js';
import { BaseAgent } from './base-agent.js';
import {
  type AgentRuntimeConfig,
  type BaseAgentConfig,
  type AgentStepResult,
  type AgentLifecycleState,
  AgentRuntimeNotFoundError,
  AgentLifecycleError,
  AgentRuntimeStatus,
  deepFreeze,
} from './types.js';
import { TaskStatus, PlannerNotAttachedError } from '../planner/types.js';
import type { Planner, TaskTree, PlannerResult } from '../planner/types.js';
import { TaskTreeManager } from '../planner/task-tree.js';

/**
 * Unified runtime managing agent lifecycle, state isolation, and memory binding.
 *
 * Provider-agnostic and deterministic. Tracks each agent's status
 * (Idle/Running/Paused/Terminated/Failed), isolates per-agent execution
 * context, and binds the TASK-0037 memory layer to every agent it creates.
 */
export class AgentRuntime {
  private readonly agents: Map<string, BaseAgent>;
  private readonly memory: MemoryBundle | undefined;
  private readonly eventBus: IEventBus | undefined;
  private planner: Planner | undefined;

  constructor(config: AgentRuntimeConfig = {}) {
    this.agents = new Map();
    this.memory = config.memory;
    this.eventBus = config.eventBus;
    this.planner = config.planner;
  }

  /**
   * Registers an already-constructed agent.
   */
  public registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.getAgentId(), agent);
    this.publish('agent.registered', { agentId: agent.getAgentId() });
  }

  /**
   * Creates and registers a new agent, binding the runtime memory bundle
   * unless the agent config supplies its own.
   */
  public createAgent(config: BaseAgentConfig): BaseAgent {
    if (this.agents.has(config.agentId)) {
      throw new AgentLifecycleError(`Agent already registered: ${config.agentId}`);
    }
    const agent = new BaseAgent({
      ...config,
      memory: config.memory ?? this.memory,
    });
    this.registerAgent(agent);
    return agent;
  }

  /**
   * Returns an agent by id or undefined.
   */
  public getAgent(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Returns an agent by id or throws.
   */
  public requireAgent(agentId: string): BaseAgent {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new AgentRuntimeNotFoundError(agentId);
    }
    return agent;
  }

  /**
   * Lists frozen lifecycle states for all registered agents.
   */
  public listAgents(): readonly AgentLifecycleState[] {
    return deepFreeze(Array.from(this.agents.values()).map((a) => a.getState()));
  }

  /**
   * Executes an agent cycle through the runtime and returns a frozen result.
   */
  public async executeAgent(agentId: string, input: unknown): Promise<AgentStepResult> {
    const agent = this.requireAgent(agentId);

    this.publish('agent.execution.started', { agentId });
    try {
      const result = await agent.execute(input);
      this.publish('agent.execution.completed', { agentId });
      return result;
    } catch (error) {
      this.publish('agent.execution.failed', { agentId });
      throw error;
    }
  }

  /**
   * Terminates an agent via the runtime.
   */
  public async terminateAgent(agentId: string): Promise<void> {
    const agent = this.requireAgent(agentId);
    agent.terminate();
    this.publish('agent.terminated', { agentId });
  }

  /**
   * Returns the bound memory bundle, if any.
   */
  public getMemory(): MemoryBundle | undefined {
    return this.memory;
  }

  public setPlanner(planner: Planner): void {
    this.planner = planner;
  }

  public getPlanner(): Planner | undefined {
    return this.planner;
  }

  public async planTask(input: string): Promise<TaskTree> {
    if (!this.planner) {
      throw new PlannerNotAttachedError();
    }
    const taskTree = await this.planner.planTask(input);
    this.eventBus?.publish({ type: 'planner.tasktree.created', timestamp: Date.now(), payload: { taskTree } });
    return taskTree;
  }

  public async executePlan(taskTree: TaskTree): Promise<PlannerResult> {
    if (!this.planner) {
      throw new PlannerNotAttachedError();
    }

    this.planner.validateTaskTree(taskTree);
    const manager = new TaskTreeManager(taskTree);
    const orderedNodes = manager.topologicalOrder();

    const startTime = Date.now();
    const failedTaskIds: string[] = [];
    const completedTaskIds: string[] = [];

    for (const node of orderedNodes) {
      if (node.status !== TaskStatus.Pending) {
        continue;
      }
      const dependenciesMet = node.dependencies.every((depId: string) => {
        const dependency = taskTree.nodes.find((n) => n.id === depId);
        return dependency?.status === TaskStatus.Completed;
      });
      if (!dependenciesMet) {
        continue;
      }

      if (!node.assignedAgent) {
        throw new Error(`Task node '${node.id}' is missing an assigned agent`);
      }

      const agent = this.requireAgent(node.assignedAgent);
      const result = await agent.execute(node.description);
      completedTaskIds.push(node.id);
      if (result.output !== undefined && result.output !== null) {
        node.result = result.output;
      }
      node.status = TaskStatus.Completed;
    }

    return {
      rootId: taskTree.rootId,
      status: failedTaskIds.length > 0 ? 'failed' : 'completed',
      completedTaskIds,
      failedTaskIds,
      durationMs: Date.now() - startTime,
      errors: [],
      taskTree,
    };
  }

  public async executeTaskNode(taskId: string, taskTree: TaskTree): Promise<AgentStepResult> {
    if (!this.planner) {
      throw new PlannerNotAttachedError();
    }

    this.planner.validateTaskTree(taskTree);
    const node = taskTree.nodes.find((n) => n.id === taskId);
    if (!node) {
      throw new Error(`Task node not found: ${taskId}`);
    }

    const dependenciesMet = node.dependencies.every((depId: string) => {
      const dep = taskTree.nodes.find((n) => n.id === depId);
      return dep?.status === TaskStatus.Completed;
    });
    if (!dependenciesMet) {
      throw new Error(`Dependencies for task '${taskId}' are not all completed`);
    }

    if (!node.assignedAgent) {
      throw new Error(`Task node '${node.id}' is missing an assigned agent`);
    }

    const agent = this.requireAgent(node.assignedAgent);
    const result = await agent.execute(node.description);
    node.result = result.output;
    node.status = TaskStatus.Completed;
    return result;
  }

  private publish(type: string, payload: unknown): void {
    this.eventBus?.publish({
      type,
      timestamp: Date.now(),
      payload,
    });
  }
}

// Re-export status enum for convenience of consumers importing the runtime.
export { AgentRuntimeStatus };

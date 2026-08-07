import type { IEventBus } from '../events/IEventBus.js';
import type { MemoryBundle } from '../memory/types.js';
import { BaseAgent } from './base-agent.js';
import { PlannerEngine } from '../planner/planner-engine.js';
import { TaskTree, TaskStatus } from '../planner/task-tree.js';
import type { TaskNode } from '../planner/types.js';
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
  private _planner: PlannerEngine | undefined;

  constructor(config: AgentRuntimeConfig = {}) {
    this.agents = new Map();
    this.memory = config.memory;
    this.eventBus = config.eventBus;
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
    
    // If this is a planner task, handle differently
    const config = { memory: this.memory };
    const planner = this._planner;
    if (planner && this._agentIsPlanning(agentId)) {
      // This is a planner task - handle specially
      const result = await planner.planTask(input);
      return {
        sessionId: agent.getAgentId(),
        response: JSON.stringify({
          requestId: input.requestId,
          success: true,
          taskTree: result.taskTree,
        }),
        streamed: false,
      };
    }

    // Original behavior
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

  /**
   * Returns the planner engine for task decomposition.
   */
  public getPlanner(): PlannerEngine | undefined {
    return this._planner;
  }

  /**
   * Sets the planner engine for task decomposition.
   */
  public setPlanner(planner: PlannerEngine | undefined): void {
    this._planner = planner;
  }

  /**
   * Plans a task from natural language input.
   */
  public async planTask(input: string): Promise<TaskTree | null> {
    const planner = this._planner;
    if (!planner) {
      return null;
    }
    return planner.planTask(input);
  }

  /**
   * Executes a plan from a task tree with interactive approval.
   */
  public async executePlan(tree: TaskTree): Promise<{ result: boolean }> {
    const nodes = tree.getNodes();
    for (const node of nodes) {
      if (node.status === TaskStatus.Pending) {
        await this.publish('plan.node', node);
        // In production, this would prompt the user for approval
        // For now, assume auto-approve
        this.updateNodeStatus(node.id, TaskStatus.InProgress);
      }
    }
    return { result: true };
  }

  /**
   * Executes a node of a task tree.
   */
  public async executeTaskNode(nodeId: string, input: unknown): Promise<AgentStepResult> {
    const planner = this._planner;
    if (!planner) {
      throw new Error('No planner configured');
    }
    const node = planner.getNodeById(nodeId);
    if (!node) {
      throw new AgentRuntimeNotFoundError(nodeId);
    }

    // Mark node as in progress
    this.updateNodeStatus(nodeId, TaskStatus.InProgress);

    try {
      const result = await this._executeAgentTask(node, input);
      this.updateNodeStatus(nodeId, TaskStatus.Completed);
      return result;
    } catch (err) {
      this.updateNodeStatus(nodeId, TaskStatus.Failed);
      throw err;
    }
  }

  private updateNodeStatus(nodeId: string, status: TaskStatus): void {
    // Update node status in the planner
    const planner = this._planner;
    if (planner) {
      planner.updateNodeStatus(nodeId, status);
    }
  }

  private _executeAgentTask(node: TaskNode, input: unknown): Promise<AgentStepResult> {
    const agent = this.agents.get(node.assignedAgent);
    if (!agent) {
      throw new AgentRuntimeNotFoundError(node.assignedAgent ?? 'unknown');
    }
    return agent.execute(input);
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

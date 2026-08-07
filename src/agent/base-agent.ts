import {
  AgentRuntimeStatus,
  type AgentLifecycleState,
  type AgentStepResult,
  type AgentExecutionHandler,
  type BaseAgentConfig,
  InvalidAgentStateError,
  AgentLifecycleError,
  deepFreeze,
  cloneValue,
} from './types.js';
import { AgentExecutionContext } from './agent-context.js';

/**
 * Default no-op handler so an agent can be constructed without a provider.
 * Keeps the runtime provider-agnostic at this stage.
 */
const DEFAULT_HANDLER: AgentExecutionHandler = async (input) => ({ output: input });

/**
 * Base class implementing the agent execution lifecycle:
 * Init -> Execute -> Evaluate -> Terminate, with explicit state transitions.
 *
 * Provider-agnostic: execution logic is injected via `handler`. State is
 * tracked internally and snapshots are always frozen (immutability).
 */
export class BaseAgent {
  private readonly agentId: string;
  private readonly name: string;
  private readonly context: AgentExecutionContext;
  private readonly handler: AgentExecutionHandler;
  private status: AgentRuntimeStatus;
  private cycleCount: number;
  private lastError: string | undefined;
  private readonly createdAt: number;
  private updatedAt: number;

  constructor(config: BaseAgentConfig) {
    this.agentId = config.agentId;
    this.name = config.name ?? config.agentId;
    this.context = new AgentExecutionContext(config.agentId, config.memory);
    this.handler = config.handler ?? DEFAULT_HANDLER;
    this.status = AgentRuntimeStatus.Idle;
    this.cycleCount = 0;
    this.createdAt = Date.now();
    this.updatedAt = this.createdAt;
  }

  public getAgentId(): string {
    return this.agentId;
  }

  public getName(): string {
    return this.name;
  }

  public getContext(): AgentExecutionContext {
    return this.context;
  }

  /**
   * Returns a frozen snapshot of the agent's lifecycle state.
   */
  public getState(): AgentLifecycleState {
    return deepFreeze({
      agentId: this.agentId,
      name: this.name,
      status: this.status,
      cycleCount: this.cycleCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastError: this.lastError,
    });
  }

  /**
   * Initializes the agent (idempotent outside of Terminated).
   */
  public async init(): Promise<void> {
    if (this.status === AgentRuntimeStatus.Terminated) {
      throw new InvalidAgentStateError(this.status);
    }
    this.updatedAt = Date.now();
  }

  /**
   * Executes one cycle. Valid only from Idle or Paused.
   */
  public async execute(input: unknown): Promise<AgentStepResult> {
    if (this.status !== AgentRuntimeStatus.Idle && this.status !== AgentRuntimeStatus.Paused) {
      throw new InvalidAgentStateError(this.status);
    }

    this.status = AgentRuntimeStatus.Running;
    this.updatedAt = Date.now();

    try {
      const result = await this.handler(input, this.context);
      this.cycleCount += 1;
      this.status = AgentRuntimeStatus.Idle;
      this.updatedAt = Date.now();
      return deepFreeze({
        output: cloneValue(result.output),
        metadata: result.metadata ? cloneValue(result.metadata) : undefined,
      });
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.status = AgentRuntimeStatus.Failed;
      this.updatedAt = Date.now();
      throw new AgentLifecycleError(`Agent ${this.agentId} execution failed: ${this.lastError}`);
    }
  }

  /**
   * Records an evaluation of the last result. Valid from Idle or Running.
   */
  public evaluate(result: AgentStepResult): AgentLifecycleState {
    if (this.status !== AgentRuntimeStatus.Idle && this.status !== AgentRuntimeStatus.Running) {
      throw new InvalidAgentStateError(this.status);
    }
    this.context.remember('lastEvaluation', result);
    return this.getState();
  }

  /**
   * Pauses a running agent.
   */
  public pause(): void {
    if (this.status !== AgentRuntimeStatus.Running) {
      throw new InvalidAgentStateError(this.status);
    }
    this.status = AgentRuntimeStatus.Paused;
    this.updatedAt = Date.now();
  }

  /**
   * Resumes a paused agent back to Idle.
   */
  public resume(): void {
    if (this.status !== AgentRuntimeStatus.Paused) {
      throw new InvalidAgentStateError(this.status);
    }
    this.status = AgentRuntimeStatus.Idle;
    this.updatedAt = Date.now();
  }

  /**
   * Terminates the agent. Terminal state.
   */
  public terminate(): void {
    this.status = AgentRuntimeStatus.Terminated;
    this.updatedAt = Date.now();
  }

  /**
   * Resets a failed agent back to Idle (not allowed from Terminated).
   */
  public reset(): void {
    if (this.status === AgentRuntimeStatus.Terminated) {
      throw new InvalidAgentStateError(this.status);
    }
    this.status = AgentRuntimeStatus.Idle;
    this.lastError = undefined;
    this.updatedAt = Date.now();
  }
}

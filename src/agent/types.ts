import type { MemoryBundle } from '../memory/types.js';
import type { IEventBus } from '../events/IEventBus.js';
import type { AgentExecutionContext } from './agent-context.js';

/**
 * Execution lifecycle status of an agent within the runtime.
 * Distinct from the advisors module `AgentState` (which models persona liveness).
 */
export enum AgentRuntimeStatus {
  Idle = 'idle',
  Running = 'running',
  Paused = 'paused',
  Terminated = 'terminated',
  Failed = 'failed',
}

/**
 * Immutable snapshot of an agent's lifecycle state.
 */
export interface AgentLifecycleState {
  readonly agentId: string;
  readonly name: string;
  readonly status: AgentRuntimeStatus;
  readonly cycleCount: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lastError?: string;
}

/**
 * Result of a single agent execution step.
 */
export interface AgentStepResult {
  readonly output: unknown;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Provider-agnostic execution handler. Implementations may call any LLM/tool
 * backend, but the runtime itself is not tied to a provider.
 */
export type AgentExecutionHandler = (
  input: unknown,
  context: AgentExecutionContext,
) => Promise<AgentStepResult>;

/**
 * Configuration for constructing a {@link BaseAgent}.
 */
export interface BaseAgentConfig {
  readonly agentId: string;
  readonly name?: string;
  readonly handler?: AgentExecutionHandler;
  readonly memory?: MemoryBundle;
}

/**
 * Configuration for the {@link AgentRuntime}.
 */
export interface AgentRuntimeConfig {
  readonly memory?: MemoryBundle;
  readonly eventBus?: IEventBus;
}

/**
 * Base class for all agent-runtime errors.
 */
export class AgentLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentLifecycleError';
  }
}

/**
 * Thrown when a lifecycle operation is invalid for the current status.
 */
export class InvalidAgentStateError extends AgentLifecycleError {
  public readonly currentState: string;

  constructor(currentState: string) {
    super(`Invalid agent state for operation: ${currentState}`);
    this.name = 'InvalidAgentStateError';
    this.currentState = currentState;
  }
}

/**
 * Thrown when an agent is not found in the runtime.
 */
export class AgentRuntimeNotFoundError extends AgentLifecycleError {
  public readonly agentId: string;

  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`);
    this.name = 'AgentRuntimeNotFoundError';
    this.agentId = agentId;
  }
}

/**
 * Recursively freezes a value and all nested objects/arrays.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  const record = value as Record<string, unknown>;
  for (const k of Object.keys(record)) {
    const child = record[k];
    if (child !== null && typeof child === 'object') {
      deepFreeze(child);
    }
  }
  return value;
}

/**
 * Produces a deep clone of a plain JSON-serializable value.
 */
export function cloneValue<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

import type { AgentId } from './AgentIdentity.js';
import type { AgentRuntimeState } from './AgentState.js';

/**
 * Contract for the Agent Manager.
 *
 * The manager is responsible for runtime state management of agents
 * (activation, deactivation, suspension, resume, heartbeat, status).
 * It is distinct from the registry, which stores static definitions.
 */
export interface IAgentManager {
  /**
   * Activates an agent, transitioning it to an active runtime state.
   * @throws {AgentNotFoundError} When the agent is not registered.
   * @throws {AgentStateError} When the transition is invalid.
   */
  activate(agentId: AgentId): AgentRuntimeState;

  /**
   * Deactivates an agent, transitioning it to an inactive runtime state.
   * @throws {AgentNotFoundError} When the agent is not registered.
   * @throws {AgentStateError} When the transition is invalid.
   */
  deactivate(agentId: AgentId): AgentRuntimeState;

  /**
   * Suspends an active agent.
   * @throws {AgentNotFoundError} When the agent is not registered.
   * @throws {AgentStateError} When the transition is invalid.
   */
  suspend(agentId: AgentId): AgentRuntimeState;

  /**
   * Resumes a suspended agent.
   * @throws {AgentNotFoundError} When the agent is not registered.
   * @throws {AgentStateError} When the transition is invalid.
   */
  resume(agentId: AgentId): AgentRuntimeState;

  /**
   * Records a heartbeat for an agent.
   * @throws {AgentNotFoundError} When the agent is not registered.
   */
  heartbeat(agentId: AgentId): AgentRuntimeState;

  /**
   * Returns the current runtime state of an agent.
   * @throws {AgentNotFoundError} When the agent is not registered.
   */
  getState(agentId: AgentId): AgentRuntimeState;

  /**
   * Returns whether the agent is currently available (active and not disabled).
   */
  isAvailable(agentId: AgentId): boolean;

  /**
   * Returns the current state of all managed agents as an immutable snapshot.
   */
  listStates(): Readonly<Record<string, AgentRuntimeState>>;
}
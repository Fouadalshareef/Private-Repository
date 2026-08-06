import type { IAgent } from './IAgent.js';
import type { AgentId } from './AgentIdentity.js';
import type { AgentCapability } from './AgentCapability.js';
import type { AgentRole } from './AgentRole.js';

/**
 * Contract for the Agent Registry.
 *
 * The registry is the static store of immutable agent definitions.
 * It is not responsible for runtime state management (that is the
 * Agent Manager's responsibility).
 */
export interface IAgentRegistry {
  /**
   * Registers an agent.
   * @throws {AgentAlreadyExistsError} When an agent with the same id is already registered.
   */
  register(agent: IAgent): void;

  /**
   * Unregisters an agent by id.
   * @throws {AgentNotFoundError} When the agent does not exist.
   */
  unregister(agentId: AgentId): void;

  /**
   * Finds an agent by id.
   * @throws {AgentNotFoundError} When the agent does not exist.
   */
  find(agentId: AgentId): IAgent;

  /**
   * Finds all agents matching the given role.
   */
  findByRole(role: AgentRole): readonly IAgent[];

  /**
   * Finds all agents supporting the given capability.
   */
  findByCapability(capability: AgentCapability): readonly IAgent[];

  /**
   * Lists all registered agents as an immutable snapshot.
   */
  listAll(): readonly IAgent[];

  /**
   * Enables an agent by id.
   * @throws {AgentNotFoundError} When the agent does not exist.
   */
  enable(agentId: AgentId): void;

  /**
   * Disables an agent by id.
   * @throws {AgentNotFoundError} When the agent does not exist.
   */
  disable(agentId: AgentId): void;

  /**
   * Replaces an existing agent with a new definition.
   * @throws {AgentNotFoundError} When the agent does not exist.
   */
  replace(agent: IAgent): void;

  /**
   * Checks whether an agent with the given id is registered.
   */
  exists(agentId: AgentId): boolean;

  /**
   * Returns the number of registered agents.
   */
  count(): number;
}
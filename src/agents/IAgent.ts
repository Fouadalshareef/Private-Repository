import type { AgentId, AgentMetadata, AgentPriority, AgentProfile, AgentStatus } from './AgentIdentity.js';
import type { AgentCapability } from './AgentCapability.js';
import type { AgentRole } from './AgentRole.js';
import type { IAgentContext } from './AgentContext.js';
import type { IAgentMemory } from './AgentMemory.js';

/**
 * Contract for a specialized AI agent.
 *
 * This interface is intentionally interface-only — it declares no
 * implementation logic. All concrete agents are expected to be
 * immutable runtime components.
 */
export interface IAgent {
  /** Unique agent identifier. */
  readonly id: AgentId;

  /** Immutable profile (name, title, description, avatar). */
  readonly profile: AgentProfile;

  /** Strongly-typed role. */
  readonly role: AgentRole;

  /** Immutable list of capabilities. */
  readonly capabilities: readonly AgentCapability[];

  /** Priority level (higher values represent higher priority). */
  readonly priority: AgentPriority;

  /** Current status of the agent. */
  readonly status: AgentStatus;

  /** Semantic version of the agent definition. */
  readonly version: string;

  /** Author of the agent. */
  readonly author: string;

  /** Immutable list of tags. */
  readonly tags: readonly string[];

  /** Immutable metadata key/value pairs. */
  readonly metadata: AgentMetadata;

  /** List of task types this agent supports. */
  readonly supportedTasks: readonly string[];

  /**
   * Determines whether this agent supports the given task type.
   * @param task The task type to check.
   */
  supportsTask(task: string): boolean;

  /**
   * Returns read-only context access for this agent.
   */
  getContext(): IAgentContext;

  /**
   * Returns read-only memory access for this agent.
   */
  getMemory(): IAgentMemory;

  /**
   * Returns execution metadata for this agent as a frozen record.
   */
  getExecutionMetadata(): Readonly<Record<string, string>>;
}
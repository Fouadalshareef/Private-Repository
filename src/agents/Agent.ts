import type { AgentId, AgentMetadata, AgentPriority, AgentProfile, AgentStatus } from './AgentIdentity.js';
import type { AgentCapability } from './AgentCapability.js';
import type { AgentRole } from './AgentRole.js';
import type { IAgent } from './IAgent.js';
import type { IAgentContext } from './AgentContext.js';
import type { IAgentMemory } from './AgentMemory.js';
import { AgentCapabilityMatcher } from './AgentCapabilityMatcher.js';

/**
 * Immutable default implementation of the IAgent contract.
 *
 * All reference fields are defensive-copied and frozen at construction time.
 */
export class Agent implements IAgent {
  public readonly id: AgentId;
  public readonly profile: AgentProfile;
  public readonly role: AgentRole;
  public readonly capabilities: readonly AgentCapability[];
  public readonly priority: AgentPriority;
  public readonly status: AgentStatus;
  public readonly version: string;
  public readonly author: string;
  public readonly tags: readonly string[];
  public readonly metadata: AgentMetadata;
  public readonly supportedTasks: readonly string[];

  private readonly capabilityMatcher: AgentCapabilityMatcher;

  constructor(
    id: AgentId,
    profile: AgentProfile,
    role: AgentRole,
    capabilities: readonly AgentCapability[],
    priority: AgentPriority,
    status: AgentStatus,
    version: string,
    author: string,
    tags: readonly string[],
    metadata: AgentMetadata,
    supportedTasks: readonly string[],
  ) {
    this.id = id;
    this.profile = Object.freeze({ ...profile });
    this.role = role;
    this.capabilities = Object.freeze([...capabilities]);
    this.priority = priority;
    this.status = status;
    this.version = version;
    this.author = author;
    this.tags = Object.freeze([...tags]);
    this.metadata = Object.freeze({ ...metadata });
    this.supportedTasks = Object.freeze([...supportedTasks]);
    this.capabilityMatcher = new AgentCapabilityMatcher(capabilities);
    Object.freeze(this);
  }

  public supportsTask(task: string): boolean {
    return this.supportedTasks.includes(task);
  }

  public supportsCapability(capability: AgentCapability): boolean {
    return this.capabilityMatcher.supports(capability);
  }

  public supportsAllCapabilities(capabilities: readonly AgentCapability[]): boolean {
    return this.capabilityMatcher.supportsAll(capabilities);
  }

  public supportsAnyCapability(capabilities: readonly AgentCapability[]): boolean {
    return this.capabilityMatcher.supportsAny(capabilities);
  }

  public getContext(): IAgentContext {
    return {
      get: (key: string): string | undefined => this.metadata[key],
      entries: (): Readonly<Record<string, string>> => this.metadata,
    };
  }

  public getMemory(): IAgentMemory {
    return {
      get: (): string | undefined => undefined,
      entries: (): Readonly<Record<string, string>> => Object.freeze({}),
    };
  }

  public getExecutionMetadata(): Readonly<Record<string, string>> {
    return Object.freeze({
      id: String(this.id),
      role: String(this.role),
      priority: String(this.priority),
      status: String(this.status),
      version: this.version,
      author: this.author,
    });
  }
}
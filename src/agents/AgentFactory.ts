import type { AgentId, AgentMetadata, AgentPriority, AgentProfile } from './AgentIdentity.js';
import { AgentStatus } from './AgentIdentity.js';
import type { AgentCapability } from './AgentCapability.js';
import type { AgentRole } from './AgentRole.js';
import type { IAgent } from './IAgent.js';
import { Agent } from './Agent.js';
import { InvalidAgentError } from './AgentError.js';

/**
 * Input definition for creating an agent via AgentFactory.
 */
export interface AgentDefinition {
  readonly id: AgentId | string;
  readonly profile?: Partial<AgentProfile>;
  readonly role: AgentRole | string;
  readonly capabilities?: readonly (AgentCapability | string)[];
  readonly priority?: AgentPriority;
  readonly status?: AgentStatus;
  readonly version?: string;
  readonly author?: string;
  readonly tags?: readonly string[];
  readonly metadata?: AgentMetadata;
  readonly supportedTasks?: readonly string[];
}

/**
 * Factory for safely creating immutable agents with validation,
 * default generation, defensive copies, and freezing.
 */
export class AgentFactory {
  private static readonly DEFAULT_PROFILE: Readonly<AgentProfile> = Object.freeze({
    name: 'unnamed-agent',
    title: 'Untitled Agent',
    description: 'No description provided.',
    avatar: '',
  });

  private static readonly DEFAULT_VERSION = '1.0.0';
  private static readonly DEFAULT_PRIORITY = 50;
  private static readonly DEFAULT_STATUS: AgentStatus = AgentStatus.Idle;

  /**
   * Creates an immutable IAgent from the given definition.
   * @param definition The agent definition.
   * @returns A frozen, immutable agent.
   * @throws {InvalidAgentError} When the definition is invalid.
   */
  public create(definition: AgentDefinition): IAgent {
    this.validateDefinition(definition);

    const id = String(definition.id) as AgentId;
    const profile = this.buildProfile(definition.profile);
    const role = String(definition.role) as AgentRole;
    const capabilities = this.buildCapabilities(definition.capabilities);
    const priority = definition.priority ?? AgentFactory.DEFAULT_PRIORITY;
    const status = definition.status ?? AgentFactory.DEFAULT_STATUS;
    const version = definition.version ?? AgentFactory.DEFAULT_VERSION;
    const author = definition.author ?? '';
    const tags = Object.freeze([...(definition.tags ?? [])]);
    const metadata = Object.freeze({ ...(definition.metadata ?? {}) });
    const supportedTasks = Object.freeze([...(definition.supportedTasks ?? [])]);

    return new Agent(
      id,
      profile,
      role,
      capabilities,
      priority,
      status,
      version,
      author,
      tags,
      metadata,
      supportedTasks,
    );
  }

  private validateDefinition(definition: AgentDefinition): void {
    if (!definition.id || String(definition.id).trim().length === 0) {
      throw new InvalidAgentError('Agent id is required and must be a non-empty string.');
    }
    if (!definition.role || String(definition.role).trim().length === 0) {
      throw new InvalidAgentError('Agent role is required and must be a non-empty string.');
    }
    if (typeof definition.priority === 'number' && !Number.isFinite(definition.priority)) {
      throw new InvalidAgentError('Agent priority must be a finite number.');
    }
  }

  private buildProfile(partial: Partial<AgentProfile> | undefined): AgentProfile {
    return Object.freeze({
      name: partial?.name?.trim() || AgentFactory.DEFAULT_PROFILE.name,
      title: partial?.title?.trim() || AgentFactory.DEFAULT_PROFILE.title,
      description: partial?.description?.trim() || AgentFactory.DEFAULT_PROFILE.description,
      avatar: partial?.avatar ?? AgentFactory.DEFAULT_PROFILE.avatar,
    });
  }

  private buildCapabilities(
    capabilities: readonly (AgentCapability | string)[] | undefined,
  ): readonly AgentCapability[] {
    const normalized = (capabilities ?? []).map((c) => String(c).trim());
    const unique = Array.from(new Set(normalized)).filter((c) => c.length > 0);
    return Object.freeze(unique as AgentCapability[]);
  }
}
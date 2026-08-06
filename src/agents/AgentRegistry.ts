import type { IAgent } from './IAgent.js';
import type { IAgentRegistry } from './IAgentRegistry.js';
import type { AgentId } from './AgentIdentity.js';
import type { AgentCapability } from './AgentCapability.js';
import type { AgentRole } from './AgentRole.js';
import type { IEventBus } from '../events/IEventBus.js';
import type { Event } from '../events/EventTypes.js';
import type {
  AgentRegisteredPayload,
  AgentRemovedPayload,
  AgentEnabledPayload,
  AgentDisabledPayload,
} from './AgentEvents.js';
import { AgentEvents } from './AgentEvents.js';
import { AgentAlreadyExistsError, AgentNotFoundError, InvalidAgentError } from './AgentError.js';
import { AgentState } from './AgentState.js';

/**
 * Map-based implementation of the Agent Registry.
 *
 * Not a singleton — instances are created via constructor injection.
 * All returned snapshots are defensive copies.
 */
export class AgentRegistry implements IAgentRegistry {
  private readonly agents: Map<string, IAgent>;
  private readonly eventBus?: IEventBus;

  constructor(eventBus?: IEventBus) {
    this.agents = new Map<string, IAgent>();
    this.eventBus = eventBus;
  }

  public register(agent: IAgent): void {
    if (!agent || !agent.id) {
      throw new InvalidAgentError('Cannot register an invalid agent.');
    }
    const key = String(agent.id);
    if (this.agents.has(key)) {
      throw new AgentAlreadyExistsError(key);
    }
    this.agents.set(key, agent);
    this.publish<AgentRegisteredPayload>(AgentEvents.AGENT_REGISTERED, {
      agentId: agent.id,
      timestamp: Date.now(),
      version: agent.version,
    });
  }

  public unregister(agentId: AgentId): void {
    const key = String(agentId);
    if (!this.agents.has(key)) {
      throw new AgentNotFoundError(key);
    }
    const agent = this.agents.get(key);
    this.agents.delete(key);
    this.publish<AgentRemovedPayload>(AgentEvents.AGENT_REMOVED, {
      agentId,
      timestamp: Date.now(),
      version: agent?.version ?? '',
    });
  }

  public find(agentId: AgentId): IAgent {
    const key = String(agentId);
    const agent = this.agents.get(key);
    if (!agent) {
      throw new AgentNotFoundError(key);
    }
    return agent;
  }

  public findByRole(role: AgentRole): readonly IAgent[] {
    return Object.freeze(
      Array.from(this.agents.values()).filter((a) => String(a.role) === String(role)),
    );
  }

  public findByCapability(capability: AgentCapability): readonly IAgent[] {
    const cap = String(capability);
    return Object.freeze(
      Array.from(this.agents.values()).filter((a) =>
        a.capabilities.some((c) => String(c) === cap),
      ),
    );
  }

  public listAll(): readonly IAgent[] {
    return Object.freeze(Array.from(this.agents.values()));
  }

  public enable(agentId: AgentId): void {
    const key = String(agentId);
    if (!this.agents.has(key)) {
      throw new AgentNotFoundError(key);
    }
    this.publish<AgentEnabledPayload>(AgentEvents.AGENT_ENABLED, {
      agentId,
      timestamp: Date.now(),
      state: AgentState.Idle,
    });
  }

  public disable(agentId: AgentId): void {
    const key = String(agentId);
    if (!this.agents.has(key)) {
      throw new AgentNotFoundError(key);
    }
    this.publish<AgentDisabledPayload>(AgentEvents.AGENT_DISABLED, {
      agentId,
      timestamp: Date.now(),
      state: AgentState.Disabled,
    });
  }

  public replace(agent: IAgent): void {
    if (!agent || !agent.id) {
      throw new InvalidAgentError('Cannot replace with an invalid agent.');
    }
    const key = String(agent.id);
    if (!this.agents.has(key)) {
      throw new AgentNotFoundError(key);
    }
    this.agents.set(key, agent);
    this.publish<AgentRegisteredPayload>(AgentEvents.AGENT_REGISTERED, {
      agentId: agent.id,
      timestamp: Date.now(),
      version: agent.version,
    });
  }

  public exists(agentId: AgentId): boolean {
    return this.agents.has(String(agentId));
  }

  public count(): number {
    return this.agents.size;
  }

  private publish<TPayload>(type: string, payload: TPayload): void {
    if (!this.eventBus) {
      return;
    }
    const event: Event<TPayload> = {
      type,
      timestamp: Date.now(),
      payload,
    };
    this.eventBus.publish(event);
  }
}
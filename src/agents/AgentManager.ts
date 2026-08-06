import type { IAgentManager } from './IAgentManager.js';
import type { IAgentRegistry } from './IAgentRegistry.js';
import type { AgentId } from './AgentIdentity.js';
import { AgentState } from './AgentState.js';
import type { AgentRuntimeState } from './AgentState.js';
import type { IEventBus } from '../events/IEventBus.js';
import type { Event } from '../events/EventTypes.js';
import type {
  AgentActivatedPayload,
  AgentDeactivatedPayload,
  AgentStatusChangedPayload,
  AgentHeartbeatPayload,
} from './AgentEvents.js';
import { AgentEvents } from './AgentEvents.js';
import { AgentNotFoundError, AgentStateError } from './AgentError.js';

/**
 * Runtime state manager for agents.
 *
 * This is runtime management — not registry. It tracks the live
 * state of each registered agent and enforces valid state transitions.
 */
export class AgentManager implements IAgentManager {
  private readonly registry: IAgentRegistry;
  private readonly states: Map<string, AgentRuntimeState>;
  private readonly eventBus?: IEventBus;

  constructor(registry: IAgentRegistry, eventBus?: IEventBus) {
    this.registry = registry;
    this.states = new Map<string, AgentRuntimeState>();
    this.eventBus = eventBus;
  }

  public activate(agentId: AgentId): AgentRuntimeState {
    this.ensureExists(agentId);
    const current = this.getOrCreateState(agentId);
    if (current.state === AgentState.Disabled) {
      throw new AgentStateError(String(agentId), current.state, AgentState.Idle);
    }
    return this.transition(agentId, AgentState.Idle, AgentEvents.AGENT_ACTIVATED);
  }

  public deactivate(agentId: AgentId): AgentRuntimeState {
    this.ensureExists(agentId);
    const current = this.getOrCreateState(agentId);
    if (current.state === AgentState.Offline || current.state === AgentState.Disabled) {
      throw new AgentStateError(String(agentId), current.state, AgentState.Offline);
    }
    return this.transition(agentId, AgentState.Offline, AgentEvents.AGENT_DEACTIVATED);
  }

  public suspend(agentId: AgentId): AgentRuntimeState {
    this.ensureExists(agentId);
    const current = this.getOrCreateState(agentId);
    if (current.state === AgentState.Waiting || current.state === AgentState.Offline || current.state === AgentState.Disabled) {
      throw new AgentStateError(String(agentId), current.state, AgentState.Waiting);
    }
    return this.transition(agentId, AgentState.Waiting, AgentEvents.AGENT_STATUS_CHANGED);
  }

  public resume(agentId: AgentId): AgentRuntimeState {
    this.ensureExists(agentId);
    const current = this.getOrCreateState(agentId);
    if (current.state !== AgentState.Waiting) {
      throw new AgentStateError(String(agentId), current.state, AgentState.Idle);
    }
    return this.transition(agentId, AgentState.Idle, AgentEvents.AGENT_STATUS_CHANGED);
  }

  public heartbeat(agentId: AgentId): AgentRuntimeState {
    this.ensureExists(agentId);
    const current = this.getOrCreateState(agentId);
    const now = Date.now();
    const next: AgentRuntimeState = Object.freeze({
      state: current.state,
      updatedAt: current.updatedAt,
      heartbeatAt: now,
      errorMessage: current.errorMessage,
    });
    this.states.set(String(agentId), next);
    this.publish<AgentHeartbeatPayload>(AgentEvents.AGENT_HEARTBEAT, {
      agentId,
      timestamp: now,
      state: current.state,
      heartbeatAt: now,
    });
    return next;
  }

  public getState(agentId: AgentId): AgentRuntimeState {
    this.ensureExists(agentId);
    return this.getOrCreateState(agentId);
  }

  public isAvailable(agentId: AgentId): boolean {
    if (!this.registry.exists(agentId)) {
      return false;
    }
    const state = this.getOrCreateState(agentId);
    return state.state !== AgentState.Disabled && state.state !== AgentState.Offline;
  }

  public listStates(): Readonly<Record<string, AgentRuntimeState>> {
    const result: Record<string, AgentRuntimeState> = {};
    for (const [key, value] of this.states.entries()) {
      result[key] = value;
    }
    return Object.freeze(result);
  }

  private ensureExists(agentId: AgentId): void {
    if (!this.registry.exists(agentId)) {
      throw new AgentNotFoundError(String(agentId));
    }
  }

  private getOrCreateState(agentId: AgentId): AgentRuntimeState {
    const key = String(agentId);
    const existing = this.states.get(key);
    if (existing) {
      return existing;
    }
    const now = Date.now();
    const created: AgentRuntimeState = Object.freeze({
      state: AgentState.Idle,
      updatedAt: now,
      heartbeatAt: now,
    });
    this.states.set(key, created);
    return created;
  }

  private transition(
    agentId: AgentId,
    nextState: AgentState,
    eventType: string,
  ): AgentRuntimeState {
    const key = String(agentId);
    const current = this.getOrCreateState(agentId);
    const now = Date.now();
    const next: AgentRuntimeState = Object.freeze({
      state: nextState,
      updatedAt: now,
      heartbeatAt: now,
      errorMessage: current.errorMessage,
    });
    this.states.set(key, next);

    if (eventType === AgentEvents.AGENT_ACTIVATED) {
      this.publish<AgentActivatedPayload>(eventType, {
        agentId,
        timestamp: now,
        state: nextState,
      });
    } else if (eventType === AgentEvents.AGENT_DEACTIVATED) {
      this.publish<AgentDeactivatedPayload>(eventType, {
        agentId,
        timestamp: now,
        state: nextState,
      });
    } else {
      this.publish<AgentStatusChangedPayload>(eventType, {
        agentId,
        timestamp: now,
        previousState: current.state,
        currentState: nextState,
      });
    }
    return next;
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
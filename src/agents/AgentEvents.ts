import type { AgentId } from './AgentIdentity.js';
import type { AgentState } from './AgentState.js';

/**
 * Event name constants for the multi-agent core architecture.
 */
export const AgentEvents = {
  /** Emitted when an agent is registered. */
  AGENT_REGISTERED: 'agents.registered',
  /** Emitted when an agent is removed. */
  AGENT_REMOVED: 'agents.removed',
  /** Emitted when an agent is enabled. */
  AGENT_ENABLED: 'agents.enabled',
  /** Emitted when an agent is disabled. */
  AGENT_DISABLED: 'agents.disabled',
  /** Emitted when an agent is activated. */
  AGENT_ACTIVATED: 'agents.activated',
  /** Emitted when an agent is deactivated. */
  AGENT_DEACTIVATED: 'agents.deactivated',
  /** Emitted when an agent status changes. */
  AGENT_STATUS_CHANGED: 'agents.status_changed',
  /** Emitted on agent heartbeat. */
  AGENT_HEARTBEAT: 'agents.heartbeat',
} as const;

/**
 * Type of agent event names.
 */
export type AgentEventName = typeof AgentEvents[keyof typeof AgentEvents];

/**
 * Base payload for all agent events.
 */
export interface AgentEventPayload {
  readonly agentId: AgentId;
  readonly timestamp: number;
}

/**
 * Payload for the AGENT_REGISTERED event.
 */
export interface AgentRegisteredPayload extends AgentEventPayload {
  readonly version: string;
}

/**
 * Payload for the AGENT_REMOVED event.
 */
export interface AgentRemovedPayload extends AgentEventPayload {
  readonly version: string;
}

/**
 * Payload for the AGENT_ENABLED event.
 */
export interface AgentEnabledPayload extends AgentEventPayload {
  readonly state: AgentState;
}

/**
 * Payload for the AGENT_DISABLED event.
 */
export interface AgentDisabledPayload extends AgentEventPayload {
  readonly state: AgentState;
}

/**
 * Payload for the AGENT_ACTIVATED event.
 */
export interface AgentActivatedPayload extends AgentEventPayload {
  readonly state: AgentState;
}

/**
 * Payload for the AGENT_DEACTIVATED event.
 */
export interface AgentDeactivatedPayload extends AgentEventPayload {
  readonly state: AgentState;
}

/**
 * Payload for the AGENT_STATUS_CHANGED event.
 */
export interface AgentStatusChangedPayload extends AgentEventPayload {
  readonly previousState: AgentState;
  readonly currentState: AgentState;
}

/**
 * Payload for the AGENT_HEARTBEAT event.
 */
export interface AgentHeartbeatPayload extends AgentEventPayload {
  readonly state: AgentState;
  readonly heartbeatAt: number;
}
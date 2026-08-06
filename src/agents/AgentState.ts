/**
 * Runtime state of an agent.
 */
export enum AgentState {
  Idle = 'idle',
  Busy = 'busy',
  Thinking = 'thinking',
  Waiting = 'waiting',
  Offline = 'offline',
  Disabled = 'disabled',
  Error = 'error',
}

/**
 * Immutable runtime state snapshot for an agent.
 */
export interface AgentRuntimeState {
  readonly state: AgentState;
  readonly updatedAt: number;
  readonly heartbeatAt: number;
  readonly errorMessage?: string;
}
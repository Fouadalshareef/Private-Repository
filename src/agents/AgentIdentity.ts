/**
 * Strongly-typed agent identifier.
 */
export type AgentId = string & { readonly __brand: 'AgentId' };

/**
 * Priority level for an agent.
 */
export type AgentPriority = number;

/**
 * Predefined priority constants.
 */
export const AgentPriorities = {
  LOWEST: 0,
  LOW: 25,
  MEDIUM: 50,
  HIGH: 75,
  CRITICAL: 100,
} as const;

/**
 * Runtime status of an agent.
 */
export enum AgentStatus {
  Idle = 'idle',
  Busy = 'busy',
  Thinking = 'thinking',
  Waiting = 'waiting',
  Offline = 'offline',
  Disabled = 'disabled',
  Error = 'error',
}

/**
 * Immutable profile information for an agent.
 */
export interface AgentProfile {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly avatar: string;
}

/**
 * Immutable metadata container for an agent.
 */
export interface AgentMetadata {
  readonly [key: string]: string;
}

/**
 * Creates an AgentId from a string value.
 * @param value The string to create the AgentId from.
 * @returns The AgentId.
 */
export function createAgentId(value: string): AgentId {
  return value as AgentId;
}

/**
 * Creates a frozen, defensive copy of an AgentProfile.
 * @param profile The source profile.
 * @returns A frozen copy of the profile.
 */
export function createAgentProfile(profile: AgentProfile): AgentProfile {
  return Object.freeze({ ...profile });
}

/**
 * Creates a frozen, defensive copy of AgentMetadata.
 * @param metadata The source metadata.
 * @returns A frozen copy of the metadata.
 */
export function createAgentMetadata(metadata: AgentMetadata): AgentMetadata {
  return Object.freeze({ ...metadata });
}
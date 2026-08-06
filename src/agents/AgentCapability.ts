/**
 * Strongly-typed agent capability identifier.
 */
export type AgentCapability = string & { readonly __brand: 'AgentCapability' };

/**
 * Predefined capability constants.
 */
export const AgentCapabilities = {
  ARCHITECTURE: 'architecture',
  CODING: 'coding',
  REVIEW: 'review',
  TESTING: 'testing',
  SECURITY: 'security',
  PLANNING: 'planning',
  RESEARCH: 'research',
  TRANSLATION: 'translation',
  DESIGN: 'design',
  DEBUGGING: 'debugging',
  DOCUMENTATION: 'documentation',
} as const;

/**
 * Creates an AgentCapability from a string value.
 * @param value The string to create the capability from.
 * @returns The capability.
 */
export function createCapability(value: string): AgentCapability {
  return value as AgentCapability;
}
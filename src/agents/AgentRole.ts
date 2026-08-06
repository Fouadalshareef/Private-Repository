/**
 * Strongly-typed agent role identifier.
 */
export type AgentRole = string & { readonly __brand: 'AgentRole' };

/**
 * Predefined role constants.
 */
export const AgentRoles = {
  CHIEF_AI_ARCHITECT: 'chief-ai-architect',
  SOFTWARE_ENGINEER: 'software-engineer',
  SENIOR_DEVELOPER: 'senior-developer',
  REVIEWER: 'reviewer',
  DESIGNER: 'designer',
  RESEARCHER: 'researcher',
  TESTER: 'tester',
  DEBUGGER: 'debugger',
  SECURITY_EXPERT: 'security-expert',
  PERFORMANCE_ENGINEER: 'performance-engineer',
  PLANNER: 'planner',
  DOCUMENTATION_WRITER: 'documentation-writer',
} as const;

/**
 * Creates an AgentRole from a string value.
 * @param value The string to create the role from.
 * @returns The role.
 */
export function createRole(value: string): AgentRole {
  return value as AgentRole;
}
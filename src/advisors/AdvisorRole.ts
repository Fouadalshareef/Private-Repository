/**
 * Strongly-typed advisor role identifier.
 */
export type AdvisorRoleId = string & { readonly __brand: 'AdvisorRoleId' };

/**
 * Predefined advisor role identifiers.
 */
export const AdvisorRoles = {
  CHIEF_AI_ARCHITECT: 'chief-ai-architect',
  SOFTWARE_ENGINEER: 'software-engineer',
  FRONTEND_ENGINEER: 'frontend-engineer',
  BACKEND_ENGINEER: 'backend-engineer',
  UI_DESIGNER: 'ui-designer',
  UX_DESIGNER: 'ux-designer',
  DEVOPS_ENGINEER: 'devops-engineer',
  SECURITY_ADVISOR: 'security-advisor',
  DATABASE_ARCHITECT: 'database-architect',
  QA_ENGINEER: 'qa-engineer',
  DOCUMENTATION_WRITER: 'documentation-writer',
} as const;

/**
 * Creates an AdvisorRoleId from a string value.
 */
export function createAdvisorRoleId(value: string): AdvisorRoleId {
  return value as AdvisorRoleId;
}
/**
 * Role identifier for specialized agents in the orchestration system.
 */
export enum AgentRole {
  Planner = 'planner',
  Coder = 'coder',
  Reviewer = 'reviewer',
  Tester = 'tester',
  Debugger = 'debugger',
  Architect = 'architect',
  Documentation = 'documentation',
  DevOps = 'devops',
}

/**
 * Configuration for assigning roles to agents.
 */
export interface RoleAssignmentConfig {
  readonly role: AgentRole;
  readonly agentId: string;
  readonly priority: number;
  readonly capabilities: readonly string[];
}

/**
 * State of a task within the orchestration workflow.
 */
export enum TaskStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
  Blocked = 'blocked',
  ReviewRequired = 'review_required',
}

/**
 * Context passed when an agent executes a task.
 */
export interface AgentTaskContext {
  readonly taskId: string;
  readonly role: AgentRole;
  readonly input: unknown;
  readonly dependencies: readonly string[];
  readonly memorySnapshot: unknown;
}

/**
 * Result of agent task execution.
 */
export interface AgentTaskResult {
  readonly taskId: string;
  readonly success: boolean;
  readonly output?: unknown;
  readonly error?: string;
  readonly nextRole?: AgentRole;
  readonly autoApprove?: boolean;
}

/**
 * Orchestration workflow configuration.
 */
export interface OrchestratorConfig {
  readonly roles: readonly RoleAssignmentConfig[];
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly enableAutoRetry?: boolean;
  readonly enableArbitration?: boolean;
}

/**
 * Orchestration result including all intermediate outputs.
 */
export interface OrchestrationResult {
  readonly workflowId: string;
  readonly status: 'completed' | 'failed' | 'cancelled';
  readonly finalOutput?: unknown;
  readonly errors: readonly string[];
  readonly taskResults: readonly AgentTaskResult[];
  readonly durationMs: number;
}

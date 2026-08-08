/**
 * Status of a task node within a task tree.
 *
 * This is the authoritative status model for the Planner subsystem.
 * The Orchestrator maintains its own status model (with ReviewRequired)
 * for orchestration workflow states; the two are intentionally separate.
 */
export enum TaskStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
  Blocked = 'blocked',
}

/**
 * A single node in a task tree / DAG.
 *
 * The structure is intentionally minimal and extensible: additional
 * fields may be added as the planning subsystem evolves (e.g. subtasks,
 * estimated effort, priority) without breaking existing consumers.
 */
export interface TaskNode {
  readonly id: string;
  readonly description: string;
  status: TaskStatus;
  readonly dependencies: readonly string[];
  readonly assignedAgent?: string;
  result?: unknown;
  error?: string;
}

/**
 * A task tree / DAG describing a plan.
 *
 * The tree is represented as a flat node collection with explicit
 * dependency edges, which supports both strict trees and general DAGs.
 */
export interface TaskTree {
  readonly rootId: string;
  readonly nodes: readonly TaskNode[];
}

/**
 * Result of executing a task tree.
 */
export interface PlannerResult {
  readonly rootId: string;
  readonly status: 'completed' | 'failed' | 'cancelled';
  readonly completedTaskIds: readonly string[];
  readonly failedTaskIds: readonly string[];
  readonly durationMs: number;
  readonly errors: readonly string[];
  readonly taskTree: TaskTree;
}

/**
 * Contract that a Planner implementation must satisfy.
 *
 * AgentRuntime depends on Planner only through this interface.
 */
export interface Planner {
  /**
   * Generates a task tree from a natural-language goal.
   */
  planTask(goal: string): Promise<TaskTree>;

  /**
   * Validates a task tree before execution.
   *
   * Throws {@link PlanningError} if the tree is invalid.
   */
  validateTaskTree(tree: TaskTree): void;

  /**
   * Returns a node by id, or undefined if not found.
   */
  getNodeById(taskId: string): TaskNode | undefined;

  /**
   * Updates the status of a node.
   */
  updateNodeStatus(taskId: string, status: TaskStatus): void;
}

/**
 * Thrown when a planning operation fails.
 */
export class PlanningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanningError';
  }
}

/**
 * Thrown when a Planner operation is requested but no Planner
 * is attached to the runtime.
 */
export class PlannerNotAttachedError extends Error {
  constructor() {
    super('Planner is not attached to the runtime');
    this.name = 'PlannerNotAttachedError';
  }
}

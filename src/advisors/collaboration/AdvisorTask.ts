import type { AdvisorId } from '../AdvisorIdentity.js';

/**
 * Status of a delegated task.
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Immutable delegated task between advisors.
 */
export interface AdvisorTask {
  readonly taskId: string;
  readonly fromAdvisor: AdvisorId;
  readonly toAdvisor: AdvisorId;
  readonly objective: string;
  readonly priority: number;
  readonly status: TaskStatus;
  readonly deadline?: number;
  readonly createdAt: number;
  readonly completedAt?: number;
}

/**
 * Creates a frozen AdvisorTask instance.
 */
export function createAdvisorTask(task: AdvisorTask): AdvisorTask {
  return Object.freeze({
    ...task,
    fromAdvisor: task.fromAdvisor,
    toAdvisor: task.toAdvisor,
  });
}

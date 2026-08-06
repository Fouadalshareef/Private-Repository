import type { IAdvisor } from './IAdvisor.js';
import type { AdvisorId } from './AdvisorIdentity.js';

/**
 * Execution strategy for orchestration steps.
 */
export type ExecutionStrategy = 'sequential' | 'parallel' | 'conditional';

/**
 * A single step in an orchestration plan.
 */
export interface OrchestrationStep {
  /** Unique step identifier. */
  readonly id: string;

  /** The advisor to execute for this step. */
  readonly advisorId: AdvisorId;

  /** Execution strategy for this step. */
  readonly strategy: ExecutionStrategy;

  /** Input context to pass to the advisor. */
  readonly input: string;

  /** Metadata to pass to the advisor. */
  readonly metadata?: Readonly<Record<string, string>>;

  /** Maximum number of retry attempts on failure. Defaults to 0. */
  readonly maxRetries?: number;

  /** Timeout in milliseconds. Defaults to 30000. */
  readonly timeoutMs?: number;

  /** Dependencies on other step ids that must complete first. */
  readonly dependsOn?: readonly string[];
}

/**
 * A complete orchestration plan.
 */
export interface OrchestrationPlan {
  /** Unique plan identifier. */
  readonly id: string;

  /** Human-readable plan name. */
  readonly name: string;

  /** Ordered steps to execute. */
  readonly steps: readonly OrchestrationStep[];

  /** Global timeout in milliseconds. Defaults to 120000. */
  readonly timeoutMs?: number;
}

/**
 * Result of executing a single orchestration step.
 */
export interface StepResult {
  /** The step that was executed. */
  readonly step: OrchestrationStep;

  /** The advisor that was executed. */
  readonly advisor: IAdvisor;

  /** Whether the step succeeded. */
  readonly success: boolean;

  /** Output from the advisor. */
  readonly output: string;

  /** Error message if failed. */
  readonly error?: string;

  /** Number of retries attempted. */
  readonly retries: number;

  /** Execution timestamp. */
  readonly timestamp: number;
}

/**
 * Complete orchestration result.
 */
export interface OrchestrationResult {
  /** The plan that was executed. */
  readonly plan: OrchestrationPlan;

  /** Results from all executed steps. */
  readonly stepResults: readonly StepResult[];

  /** Whether the entire orchestration succeeded. */
  readonly success: boolean;

  /** Aggregated output from all successful steps. */
  readonly aggregatedOutput: string;

  /** Total execution time in milliseconds. */
  readonly durationMs: number;

  /** Timestamp when orchestration started. */
  readonly startedAt: number;

  /** Timestamp when orchestration completed. */
  readonly completedAt: number;
}

/**
 * Contract for the Advisor Orchestrator.
 *
 * Manages sequential, parallel, and conditional execution of multiple advisors
 * based on an orchestration plan. Handles context passing, retries, and failure recovery.
 */
export interface IAdvisorOrchestrator {
  /**
   * Executes an orchestration plan.
   * @param plan The orchestration plan to execute.
   * @returns An immutable orchestration result.
   */
  execute(plan: OrchestrationPlan): OrchestrationResult;

  /**
   * Validates an orchestration plan without executing it.
   * @param plan The plan to validate.
   * @returns True if the plan is valid.
   */
  validate(plan: OrchestrationPlan): boolean;
}
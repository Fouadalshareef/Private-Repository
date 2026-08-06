import type { IAdvisorOrchestrator, OrchestrationPlan, OrchestrationResult, OrchestrationStep, StepResult } from './IAdvisorOrchestrator.js';
import type { IAdvisor } from './IAdvisor.js';
import type { AdvisorCatalog } from './AdvisorCatalog.js';

/**
 * Default timeout values in milliseconds.
 */
const DEFAULT_STEP_TIMEOUT_MS = 30000;
const DEFAULT_PLAN_TIMEOUT_MS = 120000;

/**
 * Simulates advisor execution with a deterministic output.
 * In a real implementation, this would invoke the advisor's execution logic.
 */
function executeAdvisor(advisor: IAdvisor, input: string): string {
  const advisorName = advisor.profile.name;
  const specialty = advisor.profile.specialty;
  return `[${advisorName}] Processed: "${input}" (specialty: ${specialty})`;
}

/**
 * Multi-Advisor Orchestrator Engine.
 *
 * Manages sequential, parallel, and conditional execution of multiple advisors
 * based on an orchestration plan. Handles context passing, retries, and failure recovery.
 */
export class AdvisorOrchestrator implements IAdvisorOrchestrator {
  private readonly catalog: AdvisorCatalog;

  constructor(catalog: AdvisorCatalog) {
    this.catalog = catalog;
  }

  public execute(plan: OrchestrationPlan): OrchestrationResult {
    const startedAt = Date.now();
    const stepResults: StepResult[] = [];
    const aggregatedOutputs: string[] = [];
    let overallSuccess = true;

    // Handle null/undefined plan
    if (!plan || !plan.id || !plan.name || !plan.steps) {
      const completedAt = Date.now();
      const safePlan = plan ?? ({} as OrchestrationPlan);
      return this.result(safePlan, stepResults, false, '', completedAt - startedAt, startedAt, completedAt);
    }

    const timeoutMs = plan.timeoutMs ?? DEFAULT_PLAN_TIMEOUT_MS;
    const stepMap = new Map<string, OrchestrationStep>();
    for (const step of plan.steps) {
      stepMap.set(step.id, step);
    }

    // Execute steps based on dependencies
    const completedSteps = new Set<string>();
    const stepOutputs = new Map<string, string>();

    for (const step of plan.steps) {
      // Check timeout
      if (Date.now() - startedAt > timeoutMs) {
        overallSuccess = false;
        break;
      }

      // Check dependencies
      if (step.dependsOn && step.dependsOn.length > 0) {
        const allDepsCompleted = step.dependsOn.every((depId) => completedSteps.has(depId));
        if (!allDepsCompleted) {
          // Skip this step if dependencies not met - don't mark as failure
          continue;
        }
      }

      // Execute step with retries
      const stepResult = this.executeStep(step, stepMap, stepOutputs);
      stepResults.push(stepResult);
      completedSteps.add(step.id);

      if (stepResult.success) {
        stepOutputs.set(step.id, stepResult.output);
        aggregatedOutputs.push(stepResult.output);
      } else {
        overallSuccess = false;
        // Continue executing remaining steps even if one fails
      }
    }

    const completedAt = Date.now();
    const aggregatedOutput = aggregatedOutputs.join('\n\n');
    return this.result(plan, stepResults, overallSuccess, aggregatedOutput, completedAt - startedAt, startedAt, completedAt);
  }

  public validate(plan: OrchestrationPlan): boolean {
    if (!plan || !plan.id || !plan.name || !plan.steps || plan.steps.length === 0) {
      return false;
    }

    const stepIds = new Set<string>();
    for (const step of plan.steps) {
      if (!step.id || !step.advisorId) {
        return false;
      }

      // Check for duplicate step ids
      if (stepIds.has(step.id)) {
        return false;
      }
      stepIds.add(step.id);

      // Check that advisor exists in catalog
      const advisor = this.catalog.get(step.advisorId);
      if (!advisor) {
        return false;
      }

      // Check dependencies exist
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          if (!stepIds.has(depId) && !plan.steps.some((s) => s.id === depId)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  private executeStep(
    step: OrchestrationStep,
    stepMap: Map<string, OrchestrationStep>,
    stepOutputs: Map<string, string>,
  ): StepResult {
    const advisor = this.catalog.get(step.advisorId);
    if (!advisor) {
      return this.stepResult(step, advisor, false, '', `Advisor not found: ${step.advisorId}`, 0);
    }

    const maxRetries = step.maxRetries ?? 0;
    const timeoutMs = step.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;
    let lastError = '';
    let retries = 0;

    // Build input with context from dependencies
    const input = this.buildInput(step, stepMap, stepOutputs);

    // Retry loop
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Simulate execution timeout check
        const startTime = Date.now();
        const output = executeAdvisor(advisor, input);
        const duration = Date.now() - startTime;

        if (duration > timeoutMs) {
          lastError = `Step execution timed out after ${timeoutMs}ms`;
          retries = attempt;
          continue;
        }

        return this.stepResult(step, advisor, true, output, undefined, retries);
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        retries = attempt;
      }
    }

    return this.stepResult(step, advisor, false, '', lastError, retries);
  }

  private buildInput(
    step: OrchestrationStep,
    stepMap: Map<string, OrchestrationStep>,
    stepOutputs: Map<string, string>,
  ): string {
    let input = step.input;

    // Append outputs from dependent steps
    if (step.dependsOn && step.dependsOn.length > 0) {
      const depOutputs: string[] = [];
      for (const depId of step.dependsOn) {
        const depOutput = stepOutputs.get(depId);
        if (depOutput) {
          depOutputs.push(depOutput);
        }
      }
      if (depOutputs.length > 0) {
        input = `${input}\n\nContext from previous steps:\n${depOutputs.join('\n\n')}`;
      }
    }

    return input;
  }

  private stepResult(
    step: OrchestrationStep,
    advisor: IAdvisor | undefined,
    success: boolean,
    output: string,
    error: string | undefined,
    retries: number,
  ): StepResult {
    return Object.freeze({
      step: Object.freeze({ ...step }),
      advisor: advisor as IAdvisor,
      success,
      output,
      error,
      retries,
      timestamp: Date.now(),
    });
  }

  private result(
    plan: OrchestrationPlan,
    stepResults: StepResult[],
    success: boolean,
    aggregatedOutput: string,
    durationMs: number,
    startedAt: number,
    completedAt: number,
  ): OrchestrationResult {
    const safePlan = plan ?? ({} as OrchestrationPlan);
    return Object.freeze({
      plan: Object.freeze({ ...safePlan, steps: Object.freeze([...(safePlan.steps ?? [])]) }),
      stepResults: Object.freeze([...stepResults]),
      success,
      aggregatedOutput,
      durationMs,
      startedAt,
      completedAt,
    });
  }
}
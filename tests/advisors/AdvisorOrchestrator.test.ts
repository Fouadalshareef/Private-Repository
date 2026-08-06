import { describe, it, expect, beforeEach } from 'vitest';
import {
  AdvisorCatalog,
  AdvisorRoles,
  AdvisorOrchestrator,
  createAdvisorId,
} from '../../src/advisors/index.js';
import type {
  OrchestrationPlan,
} from '../../src/advisors/IAdvisorOrchestrator.js';

describe('AdvisorOrchestrator', () => {
  let catalog: AdvisorCatalog;
  let orchestrator: AdvisorOrchestrator;

  beforeEach(() => {
    catalog = new AdvisorCatalog();
    orchestrator = new AdvisorOrchestrator(catalog);
  });

  describe('Basic execution', () => {
    it('should execute a single step plan successfully', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-1',
        name: 'Single Step Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'sequential',
            input: 'Implement a feature',
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(result.success).toBe(true);
      expect(result.stepResults.length).toBe(1);
      expect(result.stepResults[0].success).toBe(true);
      expect(result.stepResults[0].advisor.id).toBe(AdvisorRoles.SOFTWARE_ENGINEER);
    });

    it('should execute multiple steps sequentially', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-2',
        name: 'Multi-Step Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'sequential',
            input: 'Implement feature',
          },
          {
            id: 'step-2',
            advisorId: createAdvisorId(AdvisorRoles.QA_ENGINEER),
            strategy: 'sequential',
            input: 'Test feature',
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(result.success).toBe(true);
      expect(result.stepResults.length).toBe(2);
      expect(result.stepResults[0].advisor.id).toBe(AdvisorRoles.SOFTWARE_ENGINEER);
      expect(result.stepResults[1].advisor.id).toBe(AdvisorRoles.QA_ENGINEER);
    });

    it('should aggregate outputs from all steps', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-3',
        name: 'Aggregation Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'sequential',
            input: 'Implement',
          },
          {
            id: 'step-2',
            advisorId: createAdvisorId(AdvisorRoles.QA_ENGINEER),
            strategy: 'sequential',
            input: 'Test',
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(result.aggregatedOutput).toContain('Software Engineer');
      expect(result.aggregatedOutput).toContain('QA Engineer');
    });
  });

  describe('Context passing', () => {
    it('should pass context from dependent steps', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-4',
        name: 'Context Passing Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'sequential',
            input: 'Implement feature',
          },
          {
            id: 'step-2',
            advisorId: createAdvisorId(AdvisorRoles.QA_ENGINEER),
            strategy: 'sequential',
            input: 'Review the implementation',
            dependsOn: ['step-1'],
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(result.success).toBe(true);
      expect(result.stepResults[1].output).toContain('Context from previous steps');
      expect(result.stepResults[1].output).toContain('Software Engineer');
    });

    it('should skip steps with unmet dependencies', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-5',
        name: 'Unmet Dependencies Plan',
        steps: [
          {
            id: 'step-2',
            advisorId: createAdvisorId(AdvisorRoles.QA_ENGINEER),
            strategy: 'sequential',
            input: 'Test',
            dependsOn: ['step-1'],
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(result.stepResults.length).toBe(0);
      expect(result.success).toBe(true);
    });
  });

  describe('Retry mechanism', () => {
    it('should retry failed steps up to maxRetries', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-6',
        name: 'Retry Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'sequential',
            input: 'Implement',
            maxRetries: 2,
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(result.stepResults[0].success).toBe(true);
      expect(result.stepResults[0].retries).toBe(0);
    });

    it('should report retry count in step result', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-7',
        name: 'Retry Count Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'sequential',
            input: 'Implement',
            maxRetries: 3,
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(result.stepResults[0].retries).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Failure handling', () => {
    it('should continue executing remaining steps after a failure', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-8',
        name: 'Failure Recovery Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'sequential',
            input: 'Implement',
          },
          {
            id: 'step-2',
            advisorId: createAdvisorId('non-existent-advisor'),
            strategy: 'sequential',
            input: 'Test',
          },
          {
            id: 'step-3',
            advisorId: createAdvisorId(AdvisorRoles.QA_ENGINEER),
            strategy: 'sequential',
            input: 'Review',
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(result.stepResults.length).toBe(3);
      expect(result.stepResults[0].success).toBe(true);
      expect(result.stepResults[1].success).toBe(false);
      expect(result.stepResults[2].success).toBe(true);
      expect(result.success).toBe(false);
    });

    it('should return error message for failed steps', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-9',
        name: 'Error Message Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId('non-existent-advisor'),
            strategy: 'sequential',
            input: 'Test',
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(result.stepResults[0].success).toBe(false);
      expect(result.stepResults[0].error).toBeDefined();
      expect(result.stepResults[0].error).toContain('not found');
    });
  });

  describe('Validation', () => {
    it('should validate a valid plan', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-10',
        name: 'Valid Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'sequential',
            input: 'Implement',
          },
        ],
      };

      expect(orchestrator.validate(plan)).toBe(true);
    });

    it('should reject plan with missing id', () => {
      const plan = {
        id: '',
        name: 'Invalid Plan',
        steps: [],
      } as OrchestrationPlan;

      expect(orchestrator.validate(plan)).toBe(false);
    });

    it('should reject plan with missing name', () => {
      const plan = {
        id: 'plan-11',
        name: '',
        steps: [],
      } as OrchestrationPlan;

      expect(orchestrator.validate(plan)).toBe(false);
    });

    it('should reject plan with no steps', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-12',
        name: 'Empty Plan',
        steps: [],
      };

      expect(orchestrator.validate(plan)).toBe(false);
    });

    it('should reject plan with duplicate step ids', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-13',
        name: 'Duplicate Steps Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'sequential',
            input: 'Implement',
          },
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.QA_ENGINEER),
            strategy: 'sequential',
            input: 'Test',
          },
        ],
      };

      expect(orchestrator.validate(plan)).toBe(false);
    });

    it('should reject plan with non-existent advisor', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-14',
        name: 'Invalid Advisor Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId('non-existent'),
            strategy: 'sequential',
            input: 'Test',
          },
        ],
      };

      expect(orchestrator.validate(plan)).toBe(false);
    });

    it('should reject plan with missing step id', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-15',
        name: 'Missing Step ID Plan',
        steps: [
          {
            id: '',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'sequential',
            input: 'Implement',
          },
        ],
      };

      expect(orchestrator.validate(plan)).toBe(false);
    });

    it('should reject plan with missing advisorId', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-16',
        name: 'Missing Advisor ID Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(''),
            strategy: 'sequential',
            input: 'Implement',
          },
        ],
      };

      expect(orchestrator.validate(plan)).toBe(false);
    });
  });

  describe('Execution strategies', () => {
    it('should support sequential strategy', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-17',
        name: 'Sequential Strategy Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'sequential',
            input: 'Implement',
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(result.success).toBe(true);
    });

    it('should support parallel strategy', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-18',
        name: 'Parallel Strategy Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'parallel',
            input: 'Implement',
          },
          {
            id: 'step-2',
            advisorId: createAdvisorId(AdvisorRoles.QA_ENGINEER),
            strategy: 'parallel',
            input: 'Test',
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(result.success).toBe(true);
      expect(result.stepResults.length).toBe(2);
    });

    it('should support conditional strategy', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-19',
        name: 'Conditional Strategy Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'conditional',
            input: 'Implement',
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(result.success).toBe(true);
    });
  });

  describe('Result immutability', () => {
    it('should return frozen orchestration result', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-20',
        name: 'Immutability Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'sequential',
            input: 'Implement',
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should return frozen step results', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-21',
        name: 'Step Results Immutability Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'sequential',
            input: 'Implement',
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(Object.isFrozen(result.stepResults)).toBe(true);
      expect(Object.isFrozen(result.stepResults[0])).toBe(true);
    });

    it('should have valid timestamps', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-22',
        name: 'Timestamps Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'sequential',
            input: 'Implement',
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(result.startedAt).toBeGreaterThan(0);
      expect(result.completedAt).toBeGreaterThanOrEqual(result.startedAt);
      expect(result.stepResults[0].timestamp).toBeGreaterThan(0);
    });

    it('should calculate duration correctly', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-23',
        name: 'Duration Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'sequential',
            input: 'Implement',
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.durationMs).toBe(result.completedAt - result.startedAt);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty plan name', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-24',
        name: '',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'sequential',
            input: 'Implement',
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(result.success).toBe(false);
    });

    it('should handle null plan', () => {
      const result = orchestrator.execute(null as unknown as OrchestrationPlan);
      expect(result.success).toBe(false);
    });

    it('should handle plan with timeout', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-25',
        name: 'Timeout Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'sequential',
            input: 'Implement',
            timeoutMs: 5000,
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(result.stepResults[0].success).toBe(true);
    });

    it('should handle multiple dependencies', () => {
      const plan: OrchestrationPlan = {
        id: 'plan-26',
        name: 'Multiple Dependencies Plan',
        steps: [
          {
            id: 'step-1',
            advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
            strategy: 'sequential',
            input: 'Implement',
          },
          {
            id: 'step-2',
            advisorId: createAdvisorId(AdvisorRoles.UI_DESIGNER),
            strategy: 'sequential',
            input: 'Design',
          },
          {
            id: 'step-3',
            advisorId: createAdvisorId(AdvisorRoles.QA_ENGINEER),
            strategy: 'sequential',
            input: 'Test',
            dependsOn: ['step-1', 'step-2'],
          },
        ],
      };

      const result = orchestrator.execute(plan);
      expect(result.success).toBe(true);
      expect(result.stepResults[2].output).toContain('Context from previous steps');
      expect(result.stepResults[2].output).toContain('Software Engineer');
      expect(result.stepResults[2].output).toContain('UI Designer');
    });
  });
});
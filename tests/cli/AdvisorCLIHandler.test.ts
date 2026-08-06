import { describe, it, expect } from 'vitest';
import { AdvisorCLIHandler } from '../../src/cli/AdvisorCLIHandler.js';
import { AdvisorCatalog } from '../../src/advisors/AdvisorCatalog.js';
import { ContextRouter } from '../../src/advisors/ContextRouter.js';

describe('AdvisorCLIHandler', () => {
  let handler: AdvisorCLIHandler;

  beforeEach(() => {
    handler = new AdvisorCLIHandler();
  });

  describe('listAdvisors', () => {
    it('should list all 11 advisors from the catalog', () => {
      const output = handler.handleCommand('/advisors');
      expect(output.kind).toBe('advisors');
      expect(output.value.advisors).toHaveLength(11);
    });

    it('should include required fields for each advisor', () => {
      const output = handler.handleCommand('/advisors');
      for (const advisor of output.value.advisors) {
        expect(advisor.id).toBeTruthy();
        expect(advisor.name).toBeTruthy();
        expect(advisor.specialty).toBeTruthy();
        expect(advisor.role).toBeTruthy();
      }
    });

    it('should return immutable advisor list', () => {
      const output = handler.handleCommand('/advisors');
      expect(Object.isFrozen(output.value.advisors)).toBe(true);
      for (const advisor of output.value.advisors) {
        expect(Object.isFrozen(advisor)).toBe(true);
      }
    });

    it('should include chief-ai-architect and software-engineer', () => {
      const output = handler.handleCommand('/advisors');
      const ids = output.value.advisors.map((a) => a.id);
      expect(ids).toContain('chief-ai-architect');
      expect(ids).toContain('software-engineer');
    });
  });

  describe('routeInput', () => {
    it('should route a query about architecture to chief-ai-architect', () => {
      const output = handler.handleCommand('/route system design architecture');
      expect(output.kind).toBe('route');
      expect(output.value.advisor?.id).toBe('chief-ai-architect');
      expect(output.value.confidence).toBeGreaterThan(0);
    });

    it('should route a query about frontend to frontend-engineer', () => {
      const output = handler.handleCommand('/route react component state management');
      expect(output.kind).toBe('route');
      expect(output.value.advisor?.id).toBe('frontend-engineer');
    });

    it('should return matched keywords', () => {
      const output = handler.handleCommand('/route security vulnerability threat');
      expect(output.kind).toBe('route');
      expect(output.value.matchedKeywords.length).toBeGreaterThan(0);
    });

    it('should return immutable route output', () => {
      const output = handler.handleCommand('/route testing qa coverage');
      expect(Object.isFrozen(output.value)).toBe(true);
    });

    it('should fallback to chief-ai-architect for unmatched queries', () => {
      const output = handler.handleCommand('/route xyzzy-plugh');
      expect(output.kind).toBe('route');
      expect(output.value.advisor?.id).toBe('chief-ai-architect');
      expect(output.value.matchedBy).toBe('fallback');
    });
  });

  describe('switchAdvisor', () => {
    it('should switch to a valid advisor', () => {
      const output = handler.handleCommand('/switch software-engineer');
      expect(output.kind).toBe('switch');
      expect(output.value.advisorId).toBe('software-engineer');
      expect(output.value.message).toContain('Software Engineer');
    });

    it('should return error for unknown advisor id', () => {
      const output = handler.handleCommand('/switch unknown-advisor');
      expect(output.kind).toBe('switch');
      expect(output.value.advisorId).toBeUndefined();
      expect(output.value.message).toContain('not found');
    });

    it('should switch using role id', () => {
      const output = handler.handleCommand('/switch security-advisor');
      expect(output.kind).toBe('switch');
      expect(output.value.advisorId).toBe('security-advisor');
    });

    it('should return immutable switch output', () => {
      const output = handler.handleCommand('/switch chief-ai-architect');
      expect(Object.isFrozen(output.value)).toBe(true);
    });
  });

  describe('getActiveAdvisorId', () => {
    it('should return undefined initially', () => {
      expect(handler.getActiveAdvisorId()).toBeUndefined();
    });

    it('should return advisor id after switch', () => {
      handler.handleCommand('/switch devops-engineer');
      expect(handler.getActiveAdvisorId()).toBe('devops-engineer');
    });
  });

  describe('routeInput with active advisor', () => {
    it('should prefer active advisor for direct routing', () => {
      handler.handleCommand('/switch frontend-engineer');
      const output = handler.handleCommand('/route responsive ui accessibility');
      expect(output.value.advisor?.id).toBe('frontend-engineer');
    });
  });

  describe('unknown command', () => {
    it('should return unknown command kind', () => {
      const output = handler.handleCommand('/unknown-command');
      expect((output as { kind: string }).kind).toBe('unknown');
      expect((output as { command: string }).command).toBe('/unknown-command');
    });
  });

  describe('invalid command usage', () => {
    it('should throw on /route without query', () => {
      expect(() => handler.handleCommand('/route')).toThrow('Usage: /route <query>');
    });

    it('should throw on /switch without advisor id', () => {
      expect(() => handler.handleCommand('/switch')).toThrow('Usage: /switch <advisorId>');
    });
  });
});

describe('AdvisorCLIHandler integration with AdvisorCatalog', () => {
  it('should reflect the same 11 advisors as AdvisorCatalog', () => {
    const catalog = new AdvisorCatalog();
    const handler = new AdvisorCLIHandler();
    const output = handler.handleCommand('/advisors');

    expect(output.value.advisors).toHaveLength(catalog.count());
    for (const advisor of output.value.advisors) {
      expect(catalog.has(advisor.id)).toBe(true);
    }
  });

  it('should integrate with ContextRouter for consistent routing', () => {
    const catalog = new AdvisorCatalog();
    const router = new ContextRouter(catalog);
    const handler = new AdvisorCLIHandler();

    const query = 'database schema sql query optimization';
    const routeResult = router.route({ input: query });
    const handlerOutput = handler.handleCommand(`/route ${query}`);

    expect(handlerOutput.value.advisor?.id).toBe(routeResult.advisor.id);
    expect(handlerOutput.value.confidence).toBe(routeResult.confidence);
  });
});

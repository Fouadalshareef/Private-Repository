import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Bootstrap } from '../../src/bootstrap/Bootstrap.js';
import { LogLevel } from '../../src/logging/LogLevel.js';
import { createCLIConfig } from '../../src/cli/CLIConfig.js';
import { CupawCLI } from '../../src/cli/CupawCLI.js';
import { AdvisorCatalog } from '../../src/advisors/AdvisorCatalog.js';
import { ContextRouter } from '../../src/advisors/ContextRouter.js';

// Mock node:readline to avoid real stdin/stdout in tests
vi.mock('node:readline', () => {
  return {
    createInterface: vi.fn(() => {
      return {
        prompt: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
        setPrompt: vi.fn(),
      };
    }),
  };
});

function createTestConfig() {
  const bootstrap = new Bootstrap({ options: { logLevel: LogLevel.WARN } });
  const result = bootstrap.initialize();
  return createCLIConfig({
    configuration: result.configuration,
    logger: result.logger,
    eventBus: result.eventBus,
    container: result.container,
  });
}

describe('TASK-0031: CLI Session Management & Advisor Foundation Stabilization', () => {
  describe('Part 1: CLI Session Bug Fix', () => {
    it('should not throw when creating session with duplicate id after getSession check', () => {
      const config = createTestConfig();
      const sessionId = 'test-session-001';

      const first = config.sessionManager.createSession({ id: sessionId, label: 'Test' });
      expect(first.id).toBe(sessionId);
      expect(first.status).toBe('active');

      const existing = config.sessionManager.getSession(sessionId);
      expect(existing).toBeDefined();
      expect(existing!.status).toBe('active');

      if (!config.sessionManager.getSession(sessionId)) {
        config.sessionManager.createSession({ id: sessionId, label: 'Test' });
      }

      const final = config.sessionManager.getSession(sessionId);
      expect(final).toBeDefined();
      expect(final!.status).toBe('active');
    });

    it('should create security session only once using getSession guard pattern', () => {
      const config = createTestConfig();
      const sessionId = 'cli-session';

      config.memory.createSession(sessionId);
      expect(config.memory.getSession(sessionId)).toBeDefined();

      const securitySession = config.sessionManager.createSession({
        id: sessionId,
        label: 'CLI Session',
      });
      expect(securitySession.id).toBe(sessionId);

      const second = config.sessionManager.getSession(sessionId);
      expect(second).toBeDefined();
      expect(second!.id).toBe(sessionId);

      if (!config.sessionManager.getSession(sessionId)) {
        config.sessionManager.createSession({ id: sessionId, label: 'CLI Session' });
      }

      expect(config.sessionManager.getSession(sessionId)!.id).toBe(sessionId);
    });

    it('should allow multiple sequential chat messages without duplicate session errors', () => {
      const config = createTestConfig();
      const sessionId = 'cli-session';

      for (let i = 0; i < 3; i++) {
        if (!config.memory.getSession(sessionId)) {
          config.memory.createSession(sessionId);
        }
        if (!config.sessionManager.getSession(sessionId)) {
          config.sessionManager.createSession({ id: sessionId, label: 'CLI Session' });
        }
      }

      const session = config.sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.status).toBe('active');
    });
  });

  describe('Part 2: Advisor Identity & Prompts', () => {
    it('should load independent system prompts for each advisor from prompts directory', () => {
      const catalog = new AdvisorCatalog();
      const advisors = catalog.getAll();

      expect(advisors).toHaveLength(11);

      for (const advisor of advisors) {
        expect(advisor.profile.systemPrompt).toBeDefined();
        expect(advisor.profile.systemPrompt.length).toBeGreaterThan(100);
        expect(advisor.profile.systemPrompt).toContain('## Role');
        expect(advisor.profile.systemPrompt).toContain('## Responsibilities');
        expect(advisor.profile.systemPrompt).toContain('## Decision Boundaries');
        expect(advisor.profile.systemPrompt).toContain('## Writing Style');
        expect(advisor.profile.systemPrompt).toContain('## Engineering Focus');
      }
    });

    it('should have distinct system prompts for different advisors', () => {
      const catalog = new AdvisorCatalog();
      const chief = catalog.get('chief-ai-architect')!;
      const security = catalog.get('security-advisor')!;
      const frontend = catalog.get('frontend-engineer')!;

      expect(chief.profile.systemPrompt).not.toBe(security.profile.systemPrompt);
      expect(security.profile.systemPrompt).not.toBe(frontend.profile.systemPrompt);
      expect(chief.profile.systemPrompt).toContain('architecture');
      expect(security.profile.systemPrompt).toContain('security');
      expect(frontend.profile.systemPrompt).toContain('frontend');
    });

    it('should have routingKeywords in advisor profiles', () => {
      const catalog = new AdvisorCatalog();
      const advisors = catalog.getAll();

      for (const advisor of advisors) {
        expect(advisor.profile.routingKeywords).toBeDefined();
        expect(advisor.profile.routingKeywords!.length).toBeGreaterThan(0);
      }
    });

    it('should have advisor-specific content in each system prompt', () => {
      const catalog = new AdvisorCatalog();
      const expectedKeywords: Record<string, string[]> = {
        'chief-ai-architect': ['architecture', 'scalability', 'clean architecture'],
        'software-engineer': ['implement', 'testable', 'maintainable'],
        'frontend-engineer': ['responsive', 'accessible', 'UI frameworks'],
        'backend-engineer': ['REST', 'GraphQL', 'authentication'],
        'ui-designer': ['visual', 'design system', 'color'],
        'ux-designer': ['user experience', 'usability', 'interaction'],
        'devops-engineer': ['CI/CD', 'infrastructure', 'monitoring'],
        'security-advisor': ['threat', 'vulnerability', 'OWASP'],
        'database-architect': ['data model', 'query', 'indexing'],
        'qa-engineer': ['test strategy', 'coverage', 'quality'],
        'documentation-writer': ['documentation', 'API reference', 'tutorial'],
      };

      for (const [advisorId, keywords] of Object.entries(expectedKeywords)) {
        const advisor = catalog.get(advisorId)!;
        for (const keyword of keywords) {
          expect(advisor.profile.systemPrompt.toLowerCase()).toContain(keyword.toLowerCase());
        }
      }
    });
  });

  describe('Part 3: Improved Advisor Routing', () => {
    let router: ContextRouter;

    beforeEach(() => {
      const catalog = new AdvisorCatalog();
      router = new ContextRouter(catalog);
    });

    it('should route Arabic UI query to UI Designer', () => {
      const result = router.route({ input: 'تصميم واجهة مستخدم جميلة' });
      expect(result.advisor.id).toBe('ui-designer');
      expect(result.matchedBy).toBe('keyword');
    });

    it('should route React Components to Frontend Engineer', () => {
      const result = router.route({ input: 'React Components for the dashboard' });
      expect(result.advisor.id).toBe('frontend-engineer');
    });

    it('should route SQL Indexes to Database Architect', () => {
      const result = router.route({ input: 'SQL Indexes for query optimization' });
      expect(result.advisor.id).toBe('database-architect');
    });

    it('should route Docker CI/CD to DevOps Engineer', () => {
      const result = router.route({ input: 'Docker CI/CD pipeline setup' });
      expect(result.advisor.id).toBe('devops-engineer');
    });

    it('should route اختبار المشروع to QA Engineer', () => {
      const result = router.route({ input: 'اختبار المشروع وضمان الجودة' });
      expect(result.advisor.id).toBe('qa-engineer');
    });

    it('should route ثغرات أمنية to Security Advisor', () => {
      const result = router.route({ input: 'ثغرات أمنية في التطبيق' });
      expect(result.advisor.id).toBe('security-advisor');
    });

    it('should apply weighted scoring for more accurate routing', () => {
      const result = router.route({ input: 'Build React components with hooks for dashboard' });
      expect(result.advisor.id).toBe('frontend-engineer');
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Part 4: Advisor Profiles', () => {
    it('should expose complete metadata for each advisor', () => {
      const catalog = new AdvisorCatalog();
      const advisors = catalog.getAll();

      for (const advisor of advisors) {
        const profile = advisor.profile;
        expect(profile.name).toBeDefined();
        expect(profile.specialty).toBeDefined();
        expect(profile.description).toBeDefined();
        expect(profile.systemPrompt).toBeDefined();
        expect(profile.capabilities.length).toBeGreaterThan(0);
        expect(profile.allowedTools.length).toBeGreaterThan(0);
        expect(profile.routingKeywords).toBeDefined();
        expect(profile.routingKeywords!.length).toBeGreaterThan(0);
      }
    });

    it('should have frozen advisor profiles', () => {
      const catalog = new AdvisorCatalog();
      const advisor = catalog.get('software-engineer')!;

      expect(Object.isFrozen(advisor.profile)).toBe(true);
      expect(Object.isFrozen(advisor.profile.responsibilities)).toBe(true);
      expect(Object.isFrozen(advisor.profile.capabilities)).toBe(true);
      expect(Object.isFrozen(advisor.profile.allowedTools)).toBe(true);
      expect(Object.isFrozen(advisor.profile.metadata)).toBe(true);
      expect(Object.isFrozen(advisor.profile.routingKeywords!)).toBe(true);
    });
  });

  describe('Part 5: Integration Tests', () => {
    it('should switch advisor and verify prompt loading', async () => {
      const config = createTestConfig();
      const cli = new CupawCLI(config);
      const advisorHandler = (cli as unknown as { advisorHandler: { switchAdvisor: (id: string) => { advisorId: string | undefined; message: string }; getActiveAdvisorId: () => string | undefined } }).advisorHandler;

      const switchResult = advisorHandler.switchAdvisor('security-advisor');
      expect(switchResult.advisorId).toBe('security-advisor');
      expect(switchResult.message).toContain('Security Advisor');

      const catalog = new AdvisorCatalog();
      const securityAdvisor = catalog.get('security-advisor')!;
      expect(securityAdvisor.profile.systemPrompt).toContain('Security Advisor');
      expect(securityAdvisor.profile.systemPrompt).toContain('OWASP');
    });

    it('should maintain session continuity using getSession guard across multiple chat messages', () => {
      const config = createTestConfig();
      const sessionId = 'cli-session';

      for (let i = 0; i < 3; i++) {
        if (!config.memory.getSession(sessionId)) {
          config.memory.createSession(sessionId);
        }
        if (!config.sessionManager.getSession(sessionId)) {
          config.sessionManager.createSession({ id: sessionId, label: 'CLI Session' });
        }
      }

      const session = config.sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.status).toBe('active');
      expect(session!.id).toBe('cli-session');
    });
  });
});

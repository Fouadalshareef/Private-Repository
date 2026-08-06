import { describe, it, expect, beforeEach } from 'vitest';
import {
  AdvisorCatalog,
  AdvisorRoles,
  ContextRouter,
  createAdvisorId,
} from '../../src/advisors/index.js';
import type { RoutingRule } from '../../src/advisors/IContextRouter.js';

describe('ContextRouter', () => {
  let catalog: AdvisorCatalog;
  let router: ContextRouter;

  beforeEach(() => {
    catalog = new AdvisorCatalog();
    router = new ContextRouter(catalog);
  });

  describe('Direct routing', () => {
    it('should route directly to a preferred advisor', () => {
      const result = router.route({
        input: 'anything',
        preferredAdvisorId: createAdvisorId(AdvisorRoles.SECURITY_ADVISOR),
      });
      expect(result.advisor.id).toBe(AdvisorRoles.SECURITY_ADVISOR);
      expect(result.matchedBy).toBe('direct');
      expect(result.confidence).toBe(1.0);
    });

    it('should fall through to keyword routing when preferred advisor not found', () => {
      const result = router.route({
        input: 'database schema design',
        preferredAdvisorId: createAdvisorId('missing-advisor'),
      });
      expect(result.advisor.id).toBe(AdvisorRoles.DATABASE_ARCHITECT);
      expect(result.matchedBy).toBe('keyword');
    });
  });

  describe('Keyword routing', () => {
    it('should route architecture keywords to Chief AI Architect', () => {
      const result = router.route({ input: 'We need to discuss the system architecture and scalability' });
      expect(result.advisor.id).toBe(AdvisorRoles.CHIEF_AI_ARCHITECT);
      expect(result.matchedBy).toBe('keyword');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should route frontend keywords to Frontend Engineer', () => {
      const result = router.route({ input: 'Please help with the React frontend component' });
      expect(result.advisor.id).toBe(AdvisorRoles.FRONTEND_ENGINEER);
      expect(result.matchedBy).toBe('keyword');
    });

    it('should route backend keywords to Backend Engineer', () => {
      const result = router.route({ input: 'Design a REST API endpoint for the server' });
      expect(result.advisor.id).toBe(AdvisorRoles.BACKEND_ENGINEER);
      expect(result.matchedBy).toBe('keyword');
    });

    it('should route security keywords to Security Advisor', () => {
      const result = router.route({ input: 'We found a security vulnerability in the authentication' });
      expect(result.advisor.id).toBe(AdvisorRoles.SECURITY_ADVISOR);
      expect(result.matchedBy).toBe('keyword');
    });

    it('should route database keywords to Database Architect', () => {
      const result = router.route({ input: 'Need help with SQL query optimization and indexing' });
      expect(result.advisor.id).toBe(AdvisorRoles.DATABASE_ARCHITECT);
      expect(result.matchedBy).toBe('keyword');
    });

    it('should route testing keywords to QA Engineer', () => {
      const result = router.route({ input: 'Write unit tests and improve test coverage' });
      expect(result.advisor.id).toBe(AdvisorRoles.QA_ENGINEER);
      expect(result.matchedBy).toBe('keyword');
    });

    it('should route documentation keywords to Documentation Writer', () => {
      const result = router.route({ input: 'Create a README and write documentation' });
      expect(result.advisor.id).toBe(AdvisorRoles.DOCUMENTATION_WRITER);
      expect(result.matchedBy).toBe('keyword');
    });

    it('should route devops keywords to DevOps Engineer', () => {
      const result = router.route({ input: 'Set up CI/CD pipeline and deploy to cloud' });
      expect(result.advisor.id).toBe(AdvisorRoles.DEVOPS_ENGINEER);
      expect(result.matchedBy).toBe('keyword');
    });

    it('should route UI keywords to UI Designer', () => {
      const result = router.route({ input: 'Improve the visual layout and color scheme of the UI' });
      expect(result.advisor.id).toBe(AdvisorRoles.UI_DESIGNER);
      expect(result.matchedBy).toBe('keyword');
    });

    it('should route UX keywords to UX Designer', () => {
      const result = router.route({ input: 'Improve the user experience and usability of the flow' });
      expect(result.advisor.id).toBe(AdvisorRoles.UX_DESIGNER);
      expect(result.matchedBy).toBe('keyword');
    });

    it('should route software keywords to Software Engineer', () => {
      const result = router.route({ input: 'Implement a new feature and refactor the code' });
      expect(result.advisor.id).toBe(AdvisorRoles.SOFTWARE_ENGINEER);
      expect(result.matchedBy).toBe('keyword');
    });

    it('should include matched keywords in result', () => {
      const result = router.route({ input: 'database schema and SQL query' });
      expect(result.matchedKeywords.length).toBeGreaterThan(0);
      expect(Object.isFrozen(result.matchedKeywords)).toBe(true);
    });
  });

  describe('Metadata routing', () => {
    it('should route by metadata role', () => {
      const result = router.route({
        input: 'some input',
        metadata: { role: 'security' },
      });
      expect(result.advisor.id).toBe(AdvisorRoles.SECURITY_ADVISOR);
      expect(result.matchedBy).toBe('metadata');
    });

    it('should route by metadata domain', () => {
      const result = router.route({
        input: 'some input',
        metadata: { domain: 'frontend' },
      });
      expect(result.advisor.id).toBe(AdvisorRoles.FRONTEND_ENGINEER);
      expect(result.matchedBy).toBe('metadata');
    });

    it('should route by metadata specialty', () => {
      const result = router.route({
        input: 'some input',
        metadata: { specialty: 'database' },
      });
      expect(result.advisor.id).toBe(AdvisorRoles.DATABASE_ARCHITECT);
      expect(result.matchedBy).toBe('metadata');
    });
  });

  describe('Custom rules', () => {
    it('should add a custom rule and route by it', () => {
      const rule: RoutingRule = {
        id: 'custom-rule-1',
        advisorId: createAdvisorId(AdvisorRoles.SECURITY_ADVISOR),
        keywords: ['penetration', 'firewall'],
        priority: 100,
      };
      router.addRule(rule);
      const result = router.route({ input: 'We need a firewall penetration test' });
      expect(result.advisor.id).toBe(AdvisorRoles.SECURITY_ADVISOR);
      expect(result.matchedBy).toBe('rule');
    });

    it('should route by custom rule metadata', () => {
      const rule: RoutingRule = {
        id: 'custom-rule-meta',
        advisorId: createAdvisorId(AdvisorRoles.QA_ENGINEER),
        keywords: [],
        metadata: { team: 'qa' },
        priority: 100,
      };
      router.addRule(rule);
      const result = router.route({
        input: 'anything',
        metadata: { team: 'qa' },
      });
      expect(result.advisor.id).toBe(AdvisorRoles.QA_ENGINEER);
      expect(result.matchedBy).toBe('metadata');
    });

    it('should remove a custom rule', () => {
      const rule: RoutingRule = {
        id: 'custom-rule-2',
        advisorId: createAdvisorId(AdvisorRoles.SECURITY_ADVISOR),
        keywords: ['firewall'],
      };
      router.addRule(rule);
      expect(router.removeRule('custom-rule-2')).toBe(true);
      expect(router.removeRule('custom-rule-2')).toBe(false);
    });

    it('should list all rules as frozen snapshot', () => {
      const rules = router.listRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(Object.isFrozen(rules)).toBe(true);
    });

    it('should prioritize custom rules over default rules', () => {
      const rule: RoutingRule = {
        id: 'custom-high-priority',
        advisorId: createAdvisorId(AdvisorRoles.DOCUMENTATION_WRITER),
        keywords: ['architecture'],
        priority: 100,
      };
      router.addRule(rule);
      const result = router.route({ input: 'architecture design' });
      expect(result.advisor.id).toBe(AdvisorRoles.DOCUMENTATION_WRITER);
      expect(result.matchedBy).toBe('rule');
    });
  });

  describe('Fallback routing', () => {
    it('should fallback to Chief AI Architect by default', () => {
      const result = router.route({ input: 'completely unrelated random text' });
      expect(result.advisor.id).toBe(AdvisorRoles.CHIEF_AI_ARCHITECT);
      expect(result.matchedBy).toBe('fallback');
      expect(result.confidence).toBe(0.3);
    });

    it('should fallback to custom fallback advisor', () => {
      const result = router.route({
        input: 'completely unrelated random text',
        fallbackAdvisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
      });
      expect(result.advisor.id).toBe(AdvisorRoles.SOFTWARE_ENGINEER);
      expect(result.matchedBy).toBe('fallback');
    });
  });

  describe('Routing result immutability', () => {
    it('should return frozen routing result', () => {
      const result = router.route({ input: 'architecture' });
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should return frozen matchedKeywords array', () => {
      const result = router.route({ input: 'architecture and scalability' });
      expect(Object.isFrozen(result.matchedKeywords)).toBe(true);
    });

    it('should have a valid timestamp', () => {
      const result = router.route({ input: 'architecture' });
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });

  describe('Capability/specialty matching', () => {
    it('should match by specialty when no keyword rule matches', () => {
      const result = router.route({ input: 'AI system architecture and platform design' });
      expect(result.advisor.id).toBe(AdvisorRoles.CHIEF_AI_ARCHITECT);
    });

    it('should match by capability name', () => {
      const result = router.route({ input: 'Need help with testing strategy' });
      expect(result.advisor.id).toBe(AdvisorRoles.QA_ENGINEER);
    });
  });
});
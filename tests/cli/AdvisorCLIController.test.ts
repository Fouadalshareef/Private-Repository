import { describe, it, expect } from 'vitest';
import { ConversationRegistry } from '../../src/conversation/ConversationRegistry.js';
import { ConversationRuntime } from '../../src/conversation/ConversationRuntime.js';
import { AdvisorCLIController, type CLIControllerOutput } from '../../src/cli/handlers/AdvisorCLIController.js';
import { AdvisorCatalog } from '../../src/advisors/AdvisorCatalog.js';
import { ContextRouter } from '../../src/advisors/ContextRouter.js';

describe('AdvisorCLIController', () => {
  let registry: ConversationRegistry;
  let runtime: ConversationRuntime;
  let controller: AdvisorCLIController;

  beforeEach(() => {
    registry = new ConversationRegistry();
    runtime = new ConversationRuntime({ registry });
    controller = new AdvisorCLIController(runtime);
  });

  describe('workspace initialization', () => {
    it('should create a default workspace if none exists', () => {
      expect(controller.getWorkspaceId()).toBeDefined();
    });

    it('should create a session when switching advisor', () => {
      controller.switchAdvisor('advisor-1');
      const active = controller.getActiveAdvisor();
      expect(active.advisorId).toBe('advisor-1');
      expect(active.sessionId).toBeDefined();
    });
  });

  describe('handleCommand', () => {
    it('should return unknown for non-slash input', () => {
      const output = controller.handleCommand('hello');
      expect((output as { kind: string }).kind).toBe('unknown');
    });

    it('should handle /active command', () => {
      const output = controller.handleCommand('/active');
      expect((output as CLIControllerOutput).kind).toBe('active');
      expect((output as { kind: 'active'; value: { active: boolean } }).value.active).toBe(false);
    });

    it('should handle /active with active advisor', () => {
      controller.switchAdvisor('advisor-1');
      const output = controller.handleCommand('/active');
      expect((output as { kind: 'active'; value: { advisorId: string | undefined } }).value.advisorId).toBe('advisor-1');
    });

    it('should handle /session command', () => {
      controller.switchAdvisor('advisor-1');
      const output = controller.handleCommand('/session');
      expect((output as { kind: 'session'; value: { advisorId: string } }).value.advisorId).toBe('advisor-1');
    });

    it('should handle /sessions command', () => {
      controller.switchAdvisor('advisor-1');
      controller.switchAdvisor('advisor-2');
      const output = controller.handleCommand('/sessions');
      expect((output as { kind: 'sessions'; value: { sessions: { sessionId: string }[] } }).value.sessions).toHaveLength(2);
    });

    it('should handle /collaboration command', () => {
      const output = controller.handleCommand('/collaboration');
      expect((output as { kind: 'collaboration' }).kind).toBe('collaboration');
    });

    it('should handle /resume command', () => {
      controller.switchAdvisor('advisor-1');
      const output = controller.handleCommand('/resume');
      expect((output as { kind: 'resume' }).kind).toBe('resume');
    });

    it('should return unknown for unhandled commands', () => {
      const output = controller.handleCommand('/unknown');
      expect((output as { kind: string }).kind).toBe('unknown');
    });
  });

  describe('immutability', () => {
    it('should return frozen output for /active', () => {
      const output = controller.handleCommand('/active') as { kind: 'active'; value: ActiveAdvisorOutput };
      expect(Object.isFrozen(output)).toBe(true);
      expect(Object.isFrozen(output.value)).toBe(true);
    });

    it('should return frozen output for /session', () => {
      controller.switchAdvisor('advisor-1');
      const output = controller.handleCommand('/session') as { kind: 'session'; value: SessionInfoOutput };
      expect(Object.isFrozen(output)).toBe(true);
      expect(Object.isFrozen(output.value)).toBe(true);
    });

    it('should return frozen output for /sessions', () => {
      const output = controller.handleCommand('/sessions') as { kind: 'sessions'; value: SessionsListOutput };
      expect(Object.isFrozen(output)).toBe(true);
      expect(Object.isFrozen(output.value)).toBe(true);
      expect(Object.isFrozen(output.value.sessions)).toBe(true);
    });

    it('should return frozen output for /collaboration', () => {
      const output = controller.handleCommand('/collaboration') as { kind: 'collaboration'; value: CollaborationOutput };
      expect(Object.isFrozen(output)).toBe(true);
      expect(Object.isFrozen(output.value)).toBe(true);
    });

    it('should return frozen output for /resume', () => {
      const output = controller.handleCommand('/resume') as { kind: 'resume'; value: ResumeOutput };
      expect(Object.isFrozen(output)).toBe(true);
      expect(Object.isFrozen(output.value)).toBe(true);
    });
  });

  describe('switchAdvisor', () => {
    it('should create a new session for a new advisor', () => {
      controller.switchAdvisor('advisor-1');
      const active = controller.getActiveAdvisor();
      expect(active.advisorId).toBe('advisor-1');
      expect(active.sessionId).toBeDefined();
    });

    it('should switch to existing session when switching back', () => {
      controller.switchAdvisor('advisor-1');
      const firstSession = controller.getActiveAdvisor().sessionId;
      controller.switchAdvisor('advisor-2');
      const secondSession = controller.getActiveAdvisor().sessionId;
      controller.switchAdvisor('advisor-1');
      const thirdSession = controller.getActiveAdvisor().sessionId;
      expect(firstSession).toBe(thirdSession);
      expect(firstSession).not.toBe(secondSession);
    });
  });

  describe('session state preservation', () => {
    it('should preserve session info across advisor switches', () => {
      controller.switchAdvisor('advisor-1');
      const session1 = controller.getSessionInfo();
      controller.switchAdvisor('advisor-2');
      const session2 = controller.getSessionInfo();
      controller.switchAdvisor('advisor-1');
      const session3 = controller.getSessionInfo();

      expect(session1.sessionId).toBe(session3.sessionId);
      expect(session1.advisorId).toBe('advisor-1');
      expect(session2.advisorId).toBe('advisor-2');
    });

    it('should list all sessions across multiple advisors', () => {
      controller.switchAdvisor('advisor-1');
      controller.switchAdvisor('advisor-2');
      const output = controller.handleCommand('/sessions') as { kind: 'sessions'; value: SessionsListOutput };
      expect(output.value.sessions).toHaveLength(2);
    });
  });

  describe('error resilience', () => {
    it('should handle empty string input', () => {
      const output = controller.handleCommand('');
      expect((output as { kind: string }).kind).toBe('unknown');
    });

    it('should handle command without leading slash', () => {
      const output = controller.handleCommand('active');
      expect((output as { kind: string }).kind).toBe('unknown');
    });

    it('should handle whitespace-only input', () => {
      const output = controller.handleCommand('   ');
      expect((output as { kind: string }).kind).toBe('unknown');
    });
  });

  describe('session resilience', () => {
    it('should not create duplicate sessions on consecutive switches to same advisor', () => {
      controller.switchAdvisor('advisor-1');
      const session1 = controller.getActiveAdvisor().sessionId;
      controller.switchAdvisor('advisor-1');
      const session2 = controller.getActiveAdvisor().sessionId;
      expect(session1).toBe(session2);
      const sessions = controller.handleCommand('/sessions') as { kind: 'sessions'; value: SessionsListOutput };
      expect(sessions.value.sessions).toHaveLength(1);
    });

    it('should handle rapid advisor switches without state corruption', () => {
      const advisors = ['advisor-1', 'advisor-2', 'advisor-1', 'advisor-3', 'advisor-2'];
      for (const advisor of advisors) {
        controller.switchAdvisor(advisor);
      }
      const active = controller.getActiveAdvisor();
      expect(active.advisorId).toBe('advisor-2');
      const sessions = controller.handleCommand('/sessions') as { kind: 'sessions'; value: SessionsListOutput };
      expect(sessions.value.sessions).toHaveLength(3);
    });

    it('should preserve session state across rapid switches', () => {
      controller.switchAdvisor('advisor-1');
      const info1 = controller.getSessionInfo();
      controller.switchAdvisor('advisor-2');
      controller.switchAdvisor('advisor-1');
      const info3 = controller.getSessionInfo();
      expect(info3.sessionId).toBe(info1.sessionId);
      expect(info3.advisorId).toBe('advisor-1');
    });
  });

  describe('Arabic multilingual routing (ContextRouter integration)', () => {
    const catalog = new AdvisorCatalog();
    const router = new ContextRouter(catalog);

    it('should route "اريد بناء واجهة مستخدم" to ui-designer or frontend-engineer (conf > 70%)', () => {
      const result = router.route({ input: 'اريد بناء واجهة مستخدم' });
      expect(['ui-designer', 'frontend-engineer']).toContain(result.advisor.id);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should route "تصميم واجهة" to ui-designer or frontend-engineer (conf > 70%)', () => {
      const result = router.route({ input: 'تصميم واجهة' });
      expect(['ui-designer', 'frontend-engineer']).toContain(result.advisor.id);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should route "قواعد بيانات SQL" to database-architect', () => {
      const result = router.route({ input: 'قواعد بيانات SQL' });
      expect(result.advisor.id).toBe('database-architect');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should route "ثغرات أمنية" to security-advisor', () => {
      const result = router.route({ input: 'ثغرات أمنية' });
      expect(result.advisor.id).toBe('security-advisor');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should route "معمارية النظام" to chief-ai-architect', () => {
      const result = router.route({ input: 'معمارية النظام' });
      expect(result.advisor.id).toBe('chief-ai-architect');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should restrict fallback only to zero keyword intersections', () => {
      const result = router.route({ input: 'zzz-qwerty-unknown-term' });
      expect(result.matchedBy).toBe('fallback');
    });
  });
});

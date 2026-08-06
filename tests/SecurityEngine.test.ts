import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from '../src/security/SessionManager.js';
import { ToolAuthorizationEngine } from '../src/security/ToolAuthorizationEngine.js';
import {
  SessionNotFoundError,
  SessionExpiredError,
  UnauthorizedToolExecutionError,
  PendingApprovalError,
  ApprovalTokenNotFoundError,
  SecurityError,
} from '../src/security/SecurityError.js';
import {
  SessionStatus,
} from '../src/security/ISessionManager.js';
import {
  ToolSensitivity,
  AuthorizationPolicy,
  AuthorizationStatus,
  AuthorizationRule,
  AuthorizationRequest,
} from '../src/security/IToolAuthorizationEngine.js';
import { SecurityEvents } from '../src/security/SecurityEvents.js';

// ── Mock helpers ──────────────────────────────────────────────────────────────

const createMockEventBus = () => ({
  publish: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  clear: vi.fn(),
});

const createMockLogger = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

// ── SessionManager ────────────────────────────────────────────────────────────

describe('SessionManager', () => {
  let manager: SessionManager;
  let eventBus: ReturnType<typeof createMockEventBus>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    eventBus = createMockEventBus();
    logger = createMockLogger();
    manager = new SessionManager({ eventBus, logger });
  });

  // ── createSession ──────────────────────────────────────────────

  describe('createSession', () => {
    it('should create a session with default options', () => {
      const state = manager.createSession();
      expect(state).toBeDefined();
      expect(state.id).toBeTruthy();
      expect(state.status).toBe(SessionStatus.ACTIVE);
      expect(state.label).toBeUndefined();
      expect(state.metadata).toEqual({});
      expect(state.createdAt).toBeGreaterThan(0);
      expect(state.lastAccessedAt).toBe(state.createdAt);
      expect(state.expiresAt).toBeUndefined();
    });

    it('should create a session with explicit ID', () => {
      const state = manager.createSession({ id: 'custom-id' });
      expect(state.id).toBe('custom-id');
    });

    it('should create a session with label and metadata', () => {
      const state = manager.createSession({
        id: 's1',
        label: 'test-session',
        metadata: { userId: 'u1', role: 'admin' },
      });
      expect(state.label).toBe('test-session');
      expect(state.metadata).toEqual({ userId: 'u1', role: 'admin' });
    });

    it('should compute expiresAt when TTL is provided', () => {
      const now = Date.now();
      const state = manager.createSession({ ttlMs: 60000 });
      expect(state.expiresAt).toBeGreaterThanOrEqual(now + 60000);
      expect(state.expiresAt).toBeLessThanOrEqual(now + 61000);
    });

    it('should throw when creating a session with a duplicate ID', () => {
      manager.createSession({ id: 'dup-id' });
      expect(() => manager.createSession({ id: 'dup-id' })).toThrow(
        'Session with id "dup-id" already exists.',
      );
    });

    it('should emit SESSION_CREATED event', () => {
      manager.createSession({ id: 'evt-sess', label: 'evt-label' });
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      const publishedEvent = eventBus.publish.mock.calls[0][0];
      expect(publishedEvent.type).toBe(SecurityEvents.SESSION_CREATED);
      expect(publishedEvent.payload).toEqual({
        sessionId: 'evt-sess',
        label: 'evt-label',
        timestamp: expect.any(Number),
      });
    });

    it('should return an immutable SessionState', () => {
      const state = manager.createSession({ id: 'immutable' });
      expect(Object.isFrozen(state)).toBe(true);
      expect(Object.isFrozen(state.metadata)).toBe(true);
    });
  });

  // ── getSession ─────────────────────────────────────────────────

  describe('getSession', () => {
    it('should return undefined for unknown sessions', () => {
      expect(manager.getSession('unknown')).toBeUndefined();
    });

    it('should return the session state for an existing session', () => {
      manager.createSession({ id: 's1', metadata: { key: 'value' } });
      const state = manager.getSession('s1')!;
      expect(state.id).toBe('s1');
      expect(state.metadata).toEqual({ key: 'value' });
    });

    it('should auto-mark expired sessions as EXPIRED', () => {
      manager.createSession({ id: 'exp-soon', ttlMs: -1000 });
      const state = manager.getSession('exp-soon')!;
      expect(state.status).toBe(SessionStatus.EXPIRED);
    });
  });

  // ── updateSession ──────────────────────────────────────────────

  describe('updateSession', () => {
    it('should update metadata of an existing session', () => {
      manager.createSession({ id: 's1', metadata: { a: 1 } });
      const updated = manager.updateSession('s1', {
        metadata: { b: 2 },
      } as UpdateSessionOptions);
      expect(updated.metadata).toEqual({ a: 1, b: 2 });
    });

    it('should update the label of an existing session', () => {
      manager.createSession({ id: 's1', label: 'old' });
      const updated = manager.updateSession('s1', { label: 'new' } as UpdateSessionOptions);
      expect(updated.label).toBe('new');
    });

    it('should extend TTL when ttlMs is provided', () => {
      manager.createSession({ id: 's1', ttlMs: 1000 });
      const before = manager.getSession('s1')!;
      const updated = manager.updateSession('s1', { ttlMs: 100000 } as UpdateSessionOptions);
      expect(updated.expiresAt).toBeGreaterThan(before.expiresAt!);
    });

    it('should throw SessionNotFoundError for unknown sessions', () => {
      expect(() => manager.updateSession('unknown', {} as UpdateSessionOptions)).toThrow(
        SessionNotFoundError,
      );
    });

    it('should throw SessionExpiredError for expired sessions', () => {
      manager.createSession({ id: 'expired', ttlMs: -1000 });
      expect(() => manager.updateSession('expired', {} as UpdateSessionOptions)).toThrow(
        SessionExpiredError,
      );
    });
  });

  // ── terminateSession ───────────────────────────────────────────

  describe('terminateSession', () => {
    it('should return false for unknown sessions', () => {
      expect(manager.terminateSession('unknown')).toBe(false);
    });

    it('should terminate an active session and return true', () => {
      manager.createSession({ id: 's1' });
      expect(manager.terminateSession('s1')).toBe(true);
      const state = manager.getSession('s1')!;
      expect(state.status).toBe(SessionStatus.TERMINATED);
    });

    it('should emit SESSION_TERMINATED event', () => {
      manager.createSession({ id: 'term-sess' });
      eventBus.publish.mockClear();
      manager.terminateSession('term-sess');
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      const publishedEvent = eventBus.publish.mock.calls[0][0];
      expect(publishedEvent.type).toBe(SecurityEvents.SESSION_TERMINATED);
      expect(publishedEvent.payload.sessionId).toBe('term-sess');
    });
  });

  // ── isActive ───────────────────────────────────────────────────

  describe('isActive', () => {
    it('should return false for unknown sessions', () => {
      expect(manager.isActive('unknown')).toBe(false);
    });

    it('should return true for active sessions', () => {
      manager.createSession({ id: 's1' });
      expect(manager.isActive('s1')).toBe(true);
    });

    it('should return false for terminated sessions', () => {
      manager.createSession({ id: 's1' });
      manager.terminateSession('s1');
      expect(manager.isActive('s1')).toBe(false);
    });

    it('should return false for expired sessions', () => {
      manager.createSession({ id: 's1', ttlMs: -1000 });
      expect(manager.isActive('s1')).toBe(false);
    });
  });

  // ── evictExpiredSessions ────────────────────────────────────────

  describe('evictExpiredSessions', () => {
    it('should evict sessions past their TTL', () => {
      manager.createSession({ id: 's1', ttlMs: 1000 });
      manager.createSession({ id: 's2', ttlMs: -1000 });
      const evicted = manager.evictExpiredSessions();
      expect(evicted).toBe(1);
      expect(manager.getSession('s2')!.status).toBe(SessionStatus.EXPIRED);
    });

    it('should emit SESSION_EXPIRED event for each evicted session', () => {
      manager.createSession({ id: 'e1', ttlMs: -1000 });
      manager.createSession({ id: 'e2', ttlMs: -1000 });
      eventBus.publish.mockClear();
      manager.evictExpiredSessions();
      expect(eventBus.publish).toHaveBeenCalledTimes(2);
      const types = eventBus.publish.mock.calls.map((c) => c[0].type);
      expect(types).toContain(SecurityEvents.SESSION_EXPIRED);
    });
  });

  // ── getActiveSessions ──────────────────────────────────────────

  describe('getActiveSessions', () => {
    it('should return only active sessions', () => {
      manager.createSession({ id: 'active' });
      manager.createSession({ id: 'expired', ttlMs: -1000 });
      manager.createSession({ id: 'terminated' });
      manager.terminateSession('terminated');
      const active = manager.getActiveSessions();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('active');
    });

    it('should return a frozen readonly array', () => {
      manager.createSession({ id: 's1' });
      const active = manager.getActiveSessions();
      expect(Object.isFrozen(active)).toBe(true);
    });
  });

  // ── sessionCount ───────────────────────────────────────────────

  describe('sessionCount', () => {
    it('should count all sessions including terminated/expired', () => {
      manager.createSession({ id: 's1' });
      manager.createSession({ id: 's2' });
      manager.terminateSession('s1');
      expect(manager.sessionCount).toBe(2);
    });
  });
});

// ── ToolAuthorizationEngine ───────────────────────────────────────────────────

describe('ToolAuthorizationEngine', () => {
  let engine: ToolAuthorizationEngine;
  let eventBus: ReturnType<typeof createMockEventBus>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    eventBus = createMockEventBus();
    logger = createMockLogger();
    engine = new ToolAuthorizationEngine({ eventBus, logger });
  });

  // ── addRule / removeRule / getRules ────────────────────────────

  describe('addRule / removeRule / getRules', () => {
    it('should add and retrieve rules', () => {
      const rule: AuthorizationRule = {
        id: 'rule-1',
        policy: AuthorizationPolicy.DENY_ALL,
        sensitivityThreshold: ToolSensitivity.LOW,
      };
      engine.addRule(rule);
      expect(engine.getRules()).toHaveLength(1);
      expect(engine.getRules()[0].id).toBe('rule-1');
    });

    it('should remove a rule by ID', () => {
      const rule: AuthorizationRule = {
        id: 'rule-1',
        policy: AuthorizationPolicy.DENY_ALL,
        sensitivityThreshold: ToolSensitivity.LOW,
      };
      engine.addRule(rule);
      expect(engine.removeRule('rule-1')).toBe(true);
      expect(engine.getRules()).toHaveLength(0);
    });

    it('should return false when removing a non-existent rule', () => {
      expect(engine.removeRule('no-such-rule')).toBe(false);
    });

    it('should return rules as a frozen readonly array', () => {
      engine.addRule({
        id: 'r1',
        policy: AuthorizationPolicy.AUTO_APPROVE,
        sensitivityThreshold: ToolSensitivity.LOW,
      });
      const rules = engine.getRules();
      expect(Object.isFrozen(rules)).toBe(true);
    });
  });

  // ── evaluate ───────────────────────────────────────────────────

  describe('evaluate', () => {
    const baseRequest = (overrides: Partial<AuthorizationRequest> = {}): AuthorizationRequest => ({
      toolName: 'dangerous-tool',
      sessionId: 'sess-1',
      sensitivity: ToolSensitivity.HIGH,
      ...overrides,
    });

    it('should APPROVE under AUTO_APPROVE default policy', () => {
      const result = engine.evaluate(baseRequest());
      expect(result.status).toBe(AuthorizationStatus.APPROVED);
      expect(result.toolName).toBe('dangerous-tool');
      expect(result.sessionId).toBe('sess-1');
    });

    it('should DENY under DENY_ALL policy', () => {
      engine.addRule({
        id: 'deny-all',
        policy: AuthorizationPolicy.DENY_ALL,
        sensitivityThreshold: ToolSensitivity.LOW,
      });
      const result = engine.evaluate(baseRequest());
      expect(result.status).toBe(AuthorizationStatus.DENIED);
      expect(result.matchedRuleId).toBe('deny-all');
    });

    it('should return REQUIRES_APPROVAL under REQUIRE_CONFIRMATION above threshold', () => {
      engine.addRule({
        id: 'confirm-high',
        policy: AuthorizationPolicy.REQUIRE_CONFIRMATION,
        sensitivityThreshold: ToolSensitivity.MEDIUM,
      });
      const result = engine.evaluate(baseRequest({ sensitivity: ToolSensitivity.HIGH }));
      expect(result.status).toBe(AuthorizationStatus.REQUIRES_APPROVAL);
      expect(result.approvalToken).toBeTruthy();
      expect(result.matchedRuleId).toBe('confirm-high');
    });

    it('should auto-approve under REQUIRE_CONFIRMATION below threshold', () => {
      engine.addRule({
        id: 'confirm-low',
        policy: AuthorizationPolicy.REQUIRE_CONFIRMATION,
        sensitivityThreshold: ToolSensitivity.HIGH,
      });
      const result = engine.evaluate(baseRequest({ sensitivity: ToolSensitivity.LOW }));
      expect(result.status).toBe(AuthorizationStatus.APPROVED);
    });

    it('should match rule-specific toolNames filter', () => {
      engine.addRule({
        id: 'specific-tool',
        toolNames: ['other-tool'],
        policy: AuthorizationPolicy.DENY_ALL,
        sensitivityThreshold: ToolSensitivity.LOW,
      });
      const result = engine.evaluate(baseRequest());
      expect(result.status).toBe(AuthorizationStatus.APPROVED);
      expect(result.matchedRuleId).toBeUndefined();
    });

    it('should apply rule when toolName matches', () => {
      engine.addRule({
        id: 'specific-tool',
        toolNames: ['dangerous-tool'],
        policy: AuthorizationPolicy.DENY_ALL,
        sensitivityThreshold: ToolSensitivity.LOW,
      });
      const result = engine.evaluate(baseRequest());
      expect(result.status).toBe(AuthorizationStatus.DENIED);
      expect(result.matchedRuleId).toBe('specific-tool');
    });

    it('should apply first matching rule (insertion order)', () => {
      engine.addRule({
        id: 'rule-approve',
        toolNames: ['dangerous-tool'],
        policy: AuthorizationPolicy.AUTO_APPROVE,
        sensitivityThreshold: ToolSensitivity.LOW,
      });
      engine.addRule({
        id: 'rule-deny',
        toolNames: ['dangerous-tool'],
        policy: AuthorizationPolicy.DENY_ALL,
        sensitivityThreshold: ToolSensitivity.LOW,
      });
      const result = engine.evaluate(baseRequest());
      expect(result.status).toBe(AuthorizationStatus.APPROVED);
      expect(result.matchedRuleId).toBe('rule-approve');
    });

    it('should emit TOOL_AUTHORIZED for approved requests', () => {
      engine.evaluate(baseRequest());
      expect(eventBus.publish).toHaveBeenCalled();
      const authorizedEvent = eventBus.publish.mock.calls.find(
        (c) => c[0].type === SecurityEvents.TOOL_AUTHORIZED,
      );
      expect(authorizedEvent).toBeDefined();
      expect(authorizedEvent![0].payload.toolName).toBe('dangerous-tool');
    });

    it('should emit TOOL_DENIED for denied requests', () => {
      engine.addRule({
        id: 'deny',
        policy: AuthorizationPolicy.DENY_ALL,
        sensitivityThreshold: ToolSensitivity.LOW,
      });
      engine.evaluate(baseRequest());
      const deniedEvent = eventBus.publish.mock.calls.find(
        (c) => c[0].type === SecurityEvents.TOOL_DENIED,
      );
      expect(deniedEvent).toBeDefined();
    });

    it('should emit APPROVAL_REQUESTED for requires-approval requests', () => {
      engine.addRule({
        id: 'confirm',
        policy: AuthorizationPolicy.REQUIRE_CONFIRMATION,
        sensitivityThreshold: ToolSensitivity.MEDIUM,
      });
      engine.evaluate(baseRequest({ sensitivity: ToolSensitivity.CRITICAL }));
      const approvalEvent = eventBus.publish.mock.calls.find(
        (c) => c[0].type === SecurityEvents.APPROVAL_REQUESTED,
      );
      expect(approvalEvent).toBeDefined();
      expect(approvalEvent![0].payload.approvalToken).toBeTruthy();
    });
  });

  // ── resolveApproval ────────────────────────────────────────────

  describe('resolveApproval', () => {
    it('should resolve an approval token to APPROVED', () => {
      engine.addRule({
        id: 'confirm',
        policy: AuthorizationPolicy.REQUIRE_CONFIRMATION,
        sensitivityThreshold: ToolSensitivity.MEDIUM,
      });
      const evaluation = engine.evaluate({
        toolName: 't1',
        sessionId: 's1',
        sensitivity: ToolSensitivity.HIGH,
      });
      const token = evaluation.approvalToken!;
      const resolved = engine.resolveApproval(token, true);
      expect(resolved.status).toBe(AuthorizationStatus.APPROVED);
      expect(resolved.approvalToken).toBe(token);
    });

    it('should resolve an approval token to DENIED', () => {
      engine.addRule({
        id: 'confirm',
        policy: AuthorizationPolicy.REQUIRE_CONFIRMATION,
        sensitivityThreshold: ToolSensitivity.MEDIUM,
      });
      const evaluation = engine.evaluate({
        toolName: 't1',
        sessionId: 's1',
        sensitivity: ToolSensitivity.HIGH,
      });
      const token = evaluation.approvalToken!;
      const resolved = engine.resolveApproval(token, false);
      expect(resolved.status).toBe(AuthorizationStatus.DENIED);
    });

    it('should throw ApprovalTokenNotFoundError for unknown tokens', () => {
      expect(() => engine.resolveApproval('no-such-token', true)).toThrow(
        ApprovalTokenNotFoundError,
      );
    });

    it('should throw ApprovalTokenNotFoundError for already-resolved tokens', () => {
      engine.addRule({
        id: 'confirm',
        policy: AuthorizationPolicy.REQUIRE_CONFIRMATION,
        sensitivityThreshold: ToolSensitivity.MEDIUM,
      });
      const evaluation = engine.evaluate({
        toolName: 't1',
        sessionId: 's1',
        sensitivity: ToolSensitivity.HIGH,
      });
      engine.resolveApproval(evaluation.approvalToken!, true);
      expect(() => engine.resolveApproval(evaluation.approvalToken!, false)).toThrow(
        ApprovalTokenNotFoundError,
      );
    });

    it('should emit APPROVAL_RESOLVED event', () => {
      engine.addRule({
        id: 'confirm',
        policy: AuthorizationPolicy.REQUIRE_CONFIRMATION,
        sensitivityThreshold: ToolSensitivity.MEDIUM,
      });
      const evaluation = engine.evaluate({
        toolName: 't1',
        sessionId: 's1',
        sensitivity: ToolSensitivity.HIGH,
      });
      eventBus.publish.mockClear();
      engine.resolveApproval(evaluation.approvalToken!, true);
      const resolvedEvent = eventBus.publish.mock.calls.find(
        (c) => c[0].type === SecurityEvents.APPROVAL_RESOLVED,
      );
      expect(resolvedEvent).toBeDefined();
      expect(resolvedEvent![0].payload.approved).toBe(true);
    });
  });

  // ── getPendingApprovals ────────────────────────────────────────

  describe('getPendingApprovals', () => {
    it('should return pending approvals for a session', () => {
      engine.addRule({
        id: 'confirm',
        policy: AuthorizationPolicy.REQUIRE_CONFIRMATION,
        sensitivityThreshold: ToolSensitivity.MEDIUM,
      });
      engine.evaluate({ toolName: 't1', sessionId: 's1', sensitivity: ToolSensitivity.HIGH });
      engine.evaluate({ toolName: 't2', sessionId: 's1', sensitivity: ToolSensitivity.HIGH });
      const pending = engine.getPendingApprovals('s1');
      expect(pending).toHaveLength(2);
    });

    it('should return empty array for sessions with no pending approvals', () => {
      expect(engine.getPendingApprovals('s1')).toHaveLength(0);
    });

    it('should not return approvals for other sessions', () => {
      engine.addRule({
        id: 'confirm',
        policy: AuthorizationPolicy.REQUIRE_CONFIRMATION,
        sensitivityThreshold: ToolSensitivity.MEDIUM,
      });
      engine.evaluate({ toolName: 't1', sessionId: 's1', sensitivity: ToolSensitivity.HIGH });
      expect(engine.getPendingApprovals('s2')).toHaveLength(0);
    });

    it('should return frozen readonly array', () => {
      engine.addRule({
        id: 'confirm',
        policy: AuthorizationPolicy.REQUIRE_CONFIRMATION,
        sensitivityThreshold: ToolSensitivity.MEDIUM,
      });
      engine.evaluate({ toolName: 't1', sessionId: 's1', sensitivity: ToolSensitivity.HIGH });
      const pending = engine.getPendingApprovals('s1');
      expect(Object.isFrozen(pending)).toBe(true);
    });
  });

  // ── clearPendingApprovals ──────────────────────────────────────

  describe('clearPendingApprovals', () => {
    it('should clear all pending approvals for a session', () => {
      engine.addRule({
        id: 'confirm',
        policy: AuthorizationPolicy.REQUIRE_CONFIRMATION,
        sensitivityThreshold: ToolSensitivity.MEDIUM,
      });
      engine.evaluate({ toolName: 't1', sessionId: 's1', sensitivity: ToolSensitivity.HIGH });
      engine.evaluate({ toolName: 't2', sessionId: 's1', sensitivity: ToolSensitivity.HIGH });
      engine.clearPendingApprovals('s1');
      expect(engine.getPendingApprovals('s1')).toHaveLength(0);
    });

    it('should not clear approvals for other sessions', () => {
      engine.addRule({
        id: 'confirm',
        policy: AuthorizationPolicy.REQUIRE_CONFIRMATION,
        sensitivityThreshold: ToolSensitivity.MEDIUM,
      });
      engine.evaluate({ toolName: 't1', sessionId: 's1', sensitivity: ToolSensitivity.HIGH });
      engine.evaluate({ toolName: 't2', sessionId: 's2', sensitivity: ToolSensitivity.HIGH });
      engine.clearPendingApprovals('s1');
      expect(engine.getPendingApprovals('s2')).toHaveLength(1);
    });
  });
});

// ── Error Classes ─────────────────────────────────────────────────────────────

describe('SecurityError classes', () => {
  it('SecurityError should be an Error with correct name', () => {
    const error = new SecurityError('test');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SecurityError);
    expect(error.name).toBe('SecurityError');
    expect(error.message).toBe('test');
  });

  it('SessionNotFoundError should carry sessionId', () => {
    const error = new SessionNotFoundError('s1');
    expect(error).toBeInstanceOf(SecurityError);
    expect(error.name).toBe('SessionNotFoundError');
    expect(error.sessionId).toBe('s1');
    expect(error.message).toContain('s1');
  });

  it('SessionExpiredError should carry sessionId', () => {
    const error = new SessionExpiredError('s2');
    expect(error).toBeInstanceOf(SecurityError);
    expect(error.name).toBe('SessionExpiredError');
    expect(error.sessionId).toBe('s2');
    expect(error.message).toContain('s2');
  });

  it('UnauthorizedToolExecutionError should carry toolName, sessionId, and reason', () => {
    const error = new UnauthorizedToolExecutionError('tool-x', 's1', 'DENY_ALL');
    expect(error).toBeInstanceOf(SecurityError);
    expect(error.name).toBe('UnauthorizedToolExecutionError');
    expect(error.toolName).toBe('tool-x');
    expect(error.sessionId).toBe('s1');
    expect(error.reason).toBe('DENY_ALL');
  });

  it('PendingApprovalError should carry toolName, sessionId, and approvalToken', () => {
    const error = new PendingApprovalError('tool-y', 's1', 'token-1');
    expect(error).toBeInstanceOf(SecurityError);
    expect(error.name).toBe('PendingApprovalError');
    expect(error.toolName).toBe('tool-y');
    expect(error.sessionId).toBe('s1');
    expect(error.approvalToken).toBe('token-1');
  });

  it('ApprovalTokenNotFoundError should carry token', () => {
    const error = new ApprovalTokenNotFoundError('token-1');
    expect(error).toBeInstanceOf(SecurityError);
    expect(error.name).toBe('ApprovalTokenNotFoundError');
    expect(error.token).toBe('token-1');
    expect(error.message).toContain('token-1');
  });
});

// ── SecurityEvents ────────────────────────────────────────────────────────────

describe('SecurityEvents', () => {
  it('should have all required event constants', () => {
    expect(SecurityEvents.SESSION_CREATED).toBe('security.session.created');
    expect(SecurityEvents.SESSION_TERMINATED).toBe('security.session.terminated');
    expect(SecurityEvents.SESSION_EXPIRED).toBe('security.session.expired');
    expect(SecurityEvents.TOOL_AUTHORIZED).toBe('security.tool.authorized');
    expect(SecurityEvents.TOOL_DENIED).toBe('security.tool.denied');
    expect(SecurityEvents.APPROVAL_REQUESTED).toBe('security.approval.requested');
    expect(SecurityEvents.APPROVAL_RESOLVED).toBe('security.approval.resolved');
  });

  it('should be a const object with derived union type', () => {
    const eventName: `${typeof SecurityEvents}[keyof typeof SecurityEvents]` =
      SecurityEvents.TOOL_AUTHORIZED;
    expect(eventName).toBe('security.tool.authorized');
  });
});

// ── Integrated: Session + Authorization Flow ──────────────────────────────────

describe('Integrated session and authorization flow', () => {
  it('should authorize tools within an active session context', () => {
    const eventBus = createMockEventBus();
    const logger = createMockLogger();
    const manager = new SessionManager({ eventBus, logger });
    const authEngine = new ToolAuthorizationEngine({ eventBus, logger });

    const session = manager.createSession({ id: 's1', label: 'integrated' });
    expect(session.status).toBe(SessionStatus.ACTIVE);

    authEngine.addRule({
      id: 'allow-low',
      policy: AuthorizationPolicy.AUTO_APPROVE,
      sensitivityThreshold: ToolSensitivity.LOW,
    });

    const result = authEngine.evaluate({
      toolName: 'read-file',
      sessionId: 's1',
      sensitivity: ToolSensitivity.LOW,
    });

    expect(result.status).toBe(AuthorizationStatus.APPROVED);
    expect(result.sessionId).toBe('s1');
    expect(manager.isActive('s1')).toBe(true);
  });

  it('should clear pending approvals when session is terminated', () => {
    const eventBus = createMockEventBus();
    const logger = createMockLogger();
    const manager = new SessionManager({ eventBus, logger });
    const authEngine = new ToolAuthorizationEngine({ eventBus, logger });

    manager.createSession({ id: 's1' });
    authEngine.addRule({
      id: 'confirm',
      policy: AuthorizationPolicy.REQUIRE_CONFIRMATION,
      sensitivityThreshold: ToolSensitivity.MEDIUM,
    });

    authEngine.evaluate({ toolName: 't1', sessionId: 's1', sensitivity: ToolSensitivity.HIGH });
    expect(authEngine.getPendingApprovals('s1')).toHaveLength(1);

    manager.terminateSession('s1');
    authEngine.clearPendingApprovals('s1');
    expect(authEngine.getPendingApprovals('s1')).toHaveLength(0);
  });

  it('should handle multiple sessions with isolated authorization state', () => {
    const eventBus = createMockEventBus();
    const logger = createMockLogger();
    const manager = new SessionManager({ eventBus, logger });
    const authEngine = new ToolAuthorizationEngine({ eventBus, logger });

    manager.createSession({ id: 's1' });
    manager.createSession({ id: 's2' });
    authEngine.addRule({
      id: 'deny',
      policy: AuthorizationPolicy.DENY_ALL,
      sensitivityThreshold: ToolSensitivity.LOW,
    });

    const r1 = authEngine.evaluate({ toolName: 't1', sessionId: 's1', sensitivity: ToolSensitivity.LOW });
    const r2 = authEngine.evaluate({ toolName: 't1', sessionId: 's2', sensitivity: ToolSensitivity.LOW });

    expect(r1.status).toBe(AuthorizationStatus.DENIED);
    expect(r2.status).toBe(AuthorizationStatus.DENIED);
    expect(r1.sessionId).toBe('s1');
    expect(r2.sessionId).toBe('s2');
    expect(manager.sessionCount).toBe(2);
  });
});

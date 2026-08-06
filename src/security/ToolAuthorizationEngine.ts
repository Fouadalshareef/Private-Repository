import type {
  IToolAuthorizationEngine,
  AuthorizationRule,
  AuthorizationRequest,
  AuthorizationResult,
  PendingApproval,
} from './IToolAuthorizationEngine.js';
import {
  AuthorizationPolicy,
  AuthorizationStatus,
  ToolSensitivity,
} from './IToolAuthorizationEngine.js';
import type { IEventBus } from '../events/IEventBus.js';
import type { ILogger } from '../logging/ILogger.js';
import { ApprovalTokenNotFoundError } from './SecurityError.js';
import { SecurityEvents } from './SecurityEvents.js';

/**
 * Configuration options for ToolAuthorizationEngine.
 */
export interface ToolAuthorizationEngineConfig {
  readonly eventBus?: IEventBus;
  readonly logger?: ILogger;
  /**
   * Global fallback policy applied when no rule matches.
   * Defaults to AUTO_APPROVE.
   */
  readonly defaultPolicy?: AuthorizationPolicy;
  /**
   * Sensitivity threshold above which REQUIRE_CONFIRMATION policy triggers
   * the REQUIRES_APPROVAL status (as opposed to DENY).
   * Defaults to HIGH.
   */
  readonly confirmationThreshold?: ToolSensitivity;
  /** Default TTL in milliseconds for pending approval requests. Defaults to 5 minutes. */
  readonly approvalTtlMs?: number;
}

/**
 * Ordered numeric weight for sensitivity levels (lower = less sensitive).
 */
const SENSITIVITY_WEIGHT: Record<ToolSensitivity, number> = {
  [ToolSensitivity.LOW]: 0,
  [ToolSensitivity.MEDIUM]: 1,
  [ToolSensitivity.HIGH]: 2,
  [ToolSensitivity.CRITICAL]: 3,
};

/**
 * Generates a unique approval token.
 */
function generateApprovalToken(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 12);
  return `appr_${ts}_${rand}`;
}

/**
 * Internal mutable pending approval record.
 */
interface MutablePendingApproval {
  token: string;
  toolName: string;
  sessionId: string;
  createdAt: number;
  expiresAt?: number;
}

/**
 * Core implementation of IToolAuthorizationEngine.
 *
 * Evaluates tool authorization requests against an ordered set of rules,
 * manages pending approval tokens, and broadcasts security audit events.
 */
export class ToolAuthorizationEngine implements IToolAuthorizationEngine {
  private readonly rules: AuthorizationRule[] = [];
  private readonly pendingApprovals: Map<string, MutablePendingApproval> = new Map();
  private readonly eventBus?: IEventBus;
  private readonly logger?: ILogger;
  private readonly defaultPolicy: AuthorizationPolicy;
  private readonly confirmationThreshold: ToolSensitivity;
  private readonly approvalTtlMs: number;

  constructor(config: ToolAuthorizationEngineConfig = {}) {
    this.eventBus = config.eventBus;
    this.logger = config.logger;
    this.defaultPolicy = config.defaultPolicy ?? AuthorizationPolicy.AUTO_APPROVE;
    this.confirmationThreshold = config.confirmationThreshold ?? ToolSensitivity.HIGH;
    this.approvalTtlMs = config.approvalTtlMs ?? 5 * 60 * 1000; // 5 minutes
  }

  // ---------------------------------------------------------------------------
  // IToolAuthorizationEngine implementation
  // ---------------------------------------------------------------------------

  /**
   * Adds an authorization rule. Rules are evaluated in insertion order; first match wins.
   */
  addRule(rule: AuthorizationRule): void {
    this.rules.push(Object.freeze({ ...rule }));
    this.logger?.info(`Authorization rule "${rule.id}" added.`);
  }

  /**
   * Removes a rule by ID. Returns true if found and removed.
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index === -1) {
      return false;
    }
    this.rules.splice(index, 1);
    this.logger?.info(`Authorization rule "${ruleId}" removed.`);
    return true;
  }

  /**
   * Returns all active rules as a frozen readonly array.
   */
  getRules(): readonly AuthorizationRule[] {
    return Object.freeze([...this.rules]);
  }

  /**
   * Evaluates an authorization request against active rules.
   * First matching rule wins; falls back to defaultPolicy.
   */
  evaluate(request: AuthorizationRequest): AuthorizationResult {
    const { toolName, sessionId, sensitivity } = request;

    // Find the first matching rule
    const matchedRule = this.findMatchingRule(toolName, sensitivity);
    const policy = matchedRule?.policy ?? this.defaultPolicy;

    let result: AuthorizationResult;

    switch (policy) {
      case AuthorizationPolicy.DENY_ALL:
        result = this.buildDenied(toolName, sessionId, matchedRule?.id, 'Policy: DENY_ALL');
        break;

      case AuthorizationPolicy.REQUIRE_CONFIRMATION: {
        // Only raise REQUIRES_APPROVAL if sensitivity meets/exceeds threshold
        if (
          SENSITIVITY_WEIGHT[sensitivity] >= SENSITIVITY_WEIGHT[this.confirmationThreshold]
        ) {
          result = this.buildRequiresApproval(toolName, sessionId, matchedRule?.id);
        } else {
          // Below threshold → auto-approve under confirmation policy
          result = this.buildApproved(toolName, sessionId, matchedRule?.id, 'Below confirmation threshold');
        }
        break;
      }

      case AuthorizationPolicy.AUTO_APPROVE:
      default:
        result = this.buildApproved(toolName, sessionId, matchedRule?.id, 'Policy: AUTO_APPROVE');
        break;
    }

    // Broadcast appropriate event
    this.broadcastEvaluationEvent(result);

    return result;
  }

  /**
   * Resolves a pending approval request.
   * Throws ApprovalTokenNotFoundError if the token is invalid or already resolved.
   */
  resolveApproval(token: string, approved: boolean): AuthorizationResult {
    const pending = this.pendingApprovals.get(token);
    if (!pending) {
      throw new ApprovalTokenNotFoundError(token);
    }

    // Remove the pending approval
    this.pendingApprovals.delete(token);

    const { toolName, sessionId } = pending;

    const result: AuthorizationResult = approved
      ? {
          toolName,
          sessionId,
          status: AuthorizationStatus.APPROVED,
          approvalToken: token,
          reason: 'Manually approved by user',
        }
      : {
          toolName,
          sessionId,
          status: AuthorizationStatus.DENIED,
          approvalToken: token,
          reason: 'Manually rejected by user',
        };

    this.logger?.info(
      `Approval token "${token}" resolved: ${approved ? 'APPROVED' : 'DENIED'} for tool "${toolName}"`,
    );

    this.publishEvent(SecurityEvents.APPROVAL_RESOLVED, {
      toolName,
      sessionId,
      approvalToken: token,
      approved,
      timestamp: Date.now(),
    });

    return result;
  }

  /**
   * Returns all pending approvals for a given session.
   */
  getPendingApprovals(sessionId: string): readonly PendingApproval[] {
    const result: PendingApproval[] = [];
    for (const [, pending] of this.pendingApprovals) {
      if (pending.sessionId === sessionId) {
        result.push(
          Object.freeze({
            token: pending.token,
            toolName: pending.toolName,
            sessionId: pending.sessionId,
            createdAt: pending.createdAt,
            expiresAt: pending.expiresAt,
          }),
        );
      }
    }
    return Object.freeze(result);
  }

  /**
   * Clears all pending approvals for a given session (e.g. on session termination).
   */
  clearPendingApprovals(sessionId: string): void {
    const toDelete: string[] = [];
    for (const [token, pending] of this.pendingApprovals) {
      if (pending.sessionId === sessionId) {
        toDelete.push(token);
      }
    }
    for (const token of toDelete) {
      this.pendingApprovals.delete(token);
    }
    if (toDelete.length > 0) {
      this.logger?.info(
        `Cleared ${toDelete.length} pending approval(s) for session "${sessionId}".`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Finds the first rule that matches the given tool name and sensitivity level.
   */
  private findMatchingRule(
    toolName: string,
    sensitivity: ToolSensitivity,
  ): AuthorizationRule | undefined {
    return this.rules.find((rule) => {
      const toolMatches =
        rule.toolNames === undefined ||
        rule.toolNames.length === 0 ||
        rule.toolNames.includes(toolName);

      const sensitivityMatches =
        SENSITIVITY_WEIGHT[sensitivity] >= SENSITIVITY_WEIGHT[rule.sensitivityThreshold];

      return toolMatches && sensitivityMatches;
    });
  }

  /**
   * Builds an APPROVED result.
   */
  private buildApproved(
    toolName: string,
    sessionId: string,
    matchedRuleId?: string,
    reason: string = 'Approved',
  ): AuthorizationResult {
    return Object.freeze({
      toolName,
      sessionId,
      status: AuthorizationStatus.APPROVED,
      matchedRuleId,
      reason,
    });
  }

  /**
   * Builds a DENIED result.
   */
  private buildDenied(
    toolName: string,
    sessionId: string,
    matchedRuleId?: string,
    reason: string = 'Denied',
  ): AuthorizationResult {
    return Object.freeze({
      toolName,
      sessionId,
      status: AuthorizationStatus.DENIED,
      matchedRuleId,
      reason,
    });
  }

  /**
   * Builds a REQUIRES_APPROVAL result and registers a pending approval token.
   */
  private buildRequiresApproval(
    toolName: string,
    sessionId: string,
    matchedRuleId?: string,
  ): AuthorizationResult {
    const token = generateApprovalToken();
    const now = Date.now();
    const expiresAt = now + this.approvalTtlMs;

    const pending: MutablePendingApproval = {
      token,
      toolName,
      sessionId,
      createdAt: now,
      expiresAt,
    };
    this.pendingApprovals.set(token, pending);

    this.logger?.info(
      `Approval required for tool "${toolName}" in session "${sessionId}". Token: "${token}"`,
    );

    return Object.freeze({
      toolName,
      sessionId,
      status: AuthorizationStatus.REQUIRES_APPROVAL,
      matchedRuleId,
      approvalToken: token,
      reason: 'Policy: REQUIRE_CONFIRMATION — user approval needed',
    });
  }

  /**
   * Broadcasts the appropriate audit event based on authorization status.
   */
  private broadcastEvaluationEvent(result: AuthorizationResult): void {
    switch (result.status) {
      case AuthorizationStatus.APPROVED:
        this.publishEvent(SecurityEvents.TOOL_AUTHORIZED, {
          toolName: result.toolName,
          sessionId: result.sessionId,
          matchedRuleId: result.matchedRuleId,
          timestamp: Date.now(),
        });
        break;

      case AuthorizationStatus.DENIED:
        this.publishEvent(SecurityEvents.TOOL_DENIED, {
          toolName: result.toolName,
          sessionId: result.sessionId,
          reason: result.reason,
          matchedRuleId: result.matchedRuleId,
          timestamp: Date.now(),
        });
        break;

      case AuthorizationStatus.REQUIRES_APPROVAL:
        this.publishEvent(SecurityEvents.APPROVAL_REQUESTED, {
          toolName: result.toolName,
          sessionId: result.sessionId,
          approvalToken: result.approvalToken!,
          timestamp: Date.now(),
        });
        break;
    }
  }

  /**
   * Publishes an event to the EventBus if configured.
   */
  private publishEvent<T>(type: string, payload: T): void {
    if (this.eventBus) {
      this.eventBus.publish({ type, timestamp: Date.now(), payload });
    }
  }
}

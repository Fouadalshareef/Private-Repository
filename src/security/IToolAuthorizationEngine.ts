/**
 * Sensitivity level of a tool — used by the authorization engine
 * to determine which policy tier to apply.
 */
export enum ToolSensitivity {
  /** Low-risk operations (e.g. read-only queries). Always auto-approved. */
  LOW = 'low',
  /** Medium-risk operations. Subject to policy evaluation. */
  MEDIUM = 'medium',
  /** High-risk operations (e.g. file writes, network calls). May require confirmation. */
  HIGH = 'high',
  /** Critical operations (e.g. system commands, destructive actions). Deny-by-default. */
  CRITICAL = 'critical',
}

/**
 * Authorization policy controlling how tool calls are handled.
 */
export enum AuthorizationPolicy {
  /** All tool calls are automatically approved without confirmation. */
  AUTO_APPROVE = 'auto_approve',
  /** Tool calls that meet the sensitivity threshold require interactive confirmation. */
  REQUIRE_CONFIRMATION = 'require_confirmation',
  /** All tool calls are denied regardless of sensitivity. */
  DENY_ALL = 'deny_all',
}

/**
 * Outcome of an authorization evaluation.
 */
export enum AuthorizationStatus {
  /** The tool call is approved and may proceed. */
  APPROVED = 'approved',
  /** The tool call is denied and must not proceed. */
  DENIED = 'denied',
  /** The tool call requires interactive user confirmation before proceeding. */
  REQUIRES_APPROVAL = 'requires_approval',
}

/**
 * Represents a single authorization rule targeting specific tools or sensitivity levels.
 */
export interface AuthorizationRule {
  /** Unique identifier for this rule. */
  readonly id: string;
  /** Optional list of tool names this rule applies to. Applies to all tools if omitted. */
  readonly toolNames?: readonly string[];
  /** Minimum sensitivity level that triggers this rule. */
  readonly sensitivityThreshold: ToolSensitivity;
  /** The policy to apply when this rule matches. */
  readonly policy: AuthorizationPolicy;
  /** Human-readable description of the rule's intent. */
  readonly description?: string;
}

/**
 * Result of evaluating an authorization request.
 */
export interface AuthorizationResult {
  /** The tool name that was evaluated. */
  readonly toolName: string;
  /** Session ID under which the evaluation occurred. */
  readonly sessionId: string;
  /** The final authorization status. */
  readonly status: AuthorizationStatus;
  /** The matched rule ID, if any. */
  readonly matchedRuleId?: string;
  /** When status is REQUIRES_APPROVAL, a unique token for resolving the approval later. */
  readonly approvalToken?: string;
  /** Human-readable reason for the decision. */
  readonly reason: string;
}

/**
 * Request context for an authorization check.
 */
export interface AuthorizationRequest {
  /** The name of the tool requesting authorization. */
  readonly toolName: string;
  /** Session ID of the requesting agent/user. */
  readonly sessionId: string;
  /** Sensitivity level of the tool being invoked. */
  readonly sensitivity: ToolSensitivity;
  /** Optional additional context metadata for audit logging. */
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Represents a pending approval request awaiting user confirmation.
 */
export interface PendingApproval {
  /** Unique token identifying this approval request. */
  readonly token: string;
  /** The tool name awaiting approval. */
  readonly toolName: string;
  /** Session ID this approval belongs to. */
  readonly sessionId: string;
  /** Timestamp when the approval request was created. */
  readonly createdAt: number;
  /** Optional TTL in milliseconds after which the request expires. */
  readonly expiresAt?: number;
}

/**
 * Contract for the Tool Authorization Engine.
 */
export interface IToolAuthorizationEngine {
  /**
   * Adds an authorization rule to the engine.
   * Rules are evaluated in insertion order; first match wins.
   */
  addRule(rule: AuthorizationRule): void;

  /**
   * Removes an authorization rule by its ID.
   * Returns true if the rule was found and removed.
   */
  removeRule(ruleId: string): boolean;

  /**
   * Returns all active authorization rules.
   */
  getRules(): readonly AuthorizationRule[];

  /**
   * Evaluates an authorization request against active rules.
   * Returns an AuthorizationResult indicating the decision.
   */
  evaluate(request: AuthorizationRequest): AuthorizationResult;

  /**
   * Resolves a pending approval request by its token.
   * @param token - The approval token returned in a REQUIRES_APPROVAL result.
   * @param approved - Whether the user approved or rejected the request.
   * @returns The resolved AuthorizationResult.
   */
  resolveApproval(token: string, approved: boolean): AuthorizationResult;

  /**
   * Returns all currently pending approval requests for a session.
   */
  getPendingApprovals(sessionId: string): readonly PendingApproval[];

  /**
   * Clears all pending approvals for a session (e.g. on session termination).
   */
  clearPendingApprovals(sessionId: string): void;
}

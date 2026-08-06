/**
 * Lifecycle event constants for the security module.
 */
export const SecurityEvents = {
  /** Emitted when a new session is created. */
  SESSION_CREATED: 'security.session.created',
  /** Emitted when a session is terminated by explicit request. */
  SESSION_TERMINATED: 'security.session.terminated',
  /** Emitted when a session expires due to TTL elapsing. */
  SESSION_EXPIRED: 'security.session.expired',
  /** Emitted when a tool call is authorized (APPROVED). */
  TOOL_AUTHORIZED: 'security.tool.authorized',
  /** Emitted when a tool call is denied (DENIED). */
  TOOL_DENIED: 'security.tool.denied',
  /** Emitted when a tool call requires interactive approval (REQUIRES_APPROVAL). */
  APPROVAL_REQUESTED: 'security.approval.requested',
  /** Emitted when a pending approval request is resolved (approved or rejected). */
  APPROVAL_RESOLVED: 'security.approval.resolved',
} as const;

/**
 * Type of all security event names.
 */
export type SecurityEventName = (typeof SecurityEvents)[keyof typeof SecurityEvents];

// ---------------------------------------------------------------------------
// Event Payload Interfaces
// ---------------------------------------------------------------------------

export interface SessionCreatedPayload {
  readonly sessionId: string;
  readonly label?: string;
  readonly timestamp: number;
}

export interface SessionTerminatedPayload {
  readonly sessionId: string;
  readonly timestamp: number;
}

export interface SessionExpiredPayload {
  readonly sessionId: string;
  readonly expiredAt: number;
  readonly timestamp: number;
}

export interface ToolAuthorizedPayload {
  readonly toolName: string;
  readonly sessionId: string;
  readonly matchedRuleId?: string;
  readonly timestamp: number;
}

export interface ToolDeniedPayload {
  readonly toolName: string;
  readonly sessionId: string;
  readonly reason: string;
  readonly matchedRuleId?: string;
  readonly timestamp: number;
}

export interface ApprovalRequestedPayload {
  readonly toolName: string;
  readonly sessionId: string;
  readonly approvalToken: string;
  readonly expiresAt?: number;
  readonly timestamp: number;
}

export interface ApprovalResolvedPayload {
  readonly toolName: string;
  readonly sessionId: string;
  readonly approvalToken: string;
  readonly approved: boolean;
  readonly timestamp: number;
}

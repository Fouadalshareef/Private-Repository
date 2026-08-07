import type { Event } from '../events/EventTypes.js';

/**
 * Event name constants for conversation lifecycle.
 */
export const ConversationEvents = {
  WORKSPACE_CREATED: 'conversation.workspace.created',
  WORKSPACE_CLOSED: 'conversation.workspace.closed',
  ADVISOR_ACTIVATED: 'conversation.advisor.activated',
  ADVISOR_SUSPENDED: 'conversation.advisor.suspended',
  SESSION_CREATED: 'conversation.session.created',
  SESSION_CLOSED: 'conversation.session.closed',
  SESSION_SWITCHED: 'conversation.session.switched',
  SNAPSHOT_CREATED: 'conversation.snapshot.created',
  SUMMARY_UPDATED: 'conversation.summary.updated',
  SHARED_NOTE_CREATED: 'conversation.shared_note.created',
  REVIEW_REQUESTED: 'conversation.review.requested',
  REVIEW_COMPLETED: 'conversation.review.completed',
  CONVERSATION_EXPORTED: 'conversation.exported',
  CONVERSATION_IMPORTED: 'conversation.imported',
} as const;

/**
 * Type for conversation event names.
 */
export type ConversationEventName = typeof ConversationEvents[keyof typeof ConversationEvents];

/**
 * Payload for workspace created event.
 */
export interface WorkspaceCreatedPayload {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly timestamp: number;
}

/**
 * Payload for workspace closed event.
 */
export interface WorkspaceClosedPayload {
  readonly workspaceId: string;
  readonly timestamp: number;
}

/**
 * Payload for advisor activated/suspended events.
 */
export interface AdvisorStateChangedPayload {
  readonly workspaceId: string;
  readonly advisorId: string;
  readonly timestamp: number;
}

/**
 * Payload for session created/closed events.
 */
export interface SessionLifecyclePayload {
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly advisorId: string;
  readonly timestamp: number;
}

/**
 * Payload for session switched event.
 */
export interface SessionSwitchedPayload {
  readonly workspaceId: string;
  readonly previousSessionId: string | undefined;
  readonly currentSessionId: string;
  readonly advisorId: string;
  readonly timestamp: number;
}

/**
 * Payload for snapshot created event.
 */
export interface SnapshotCreatedPayload {
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly snapshotId: string;
  readonly timestamp: number;
}

/**
 * Payload for summary updated event.
 */
export interface SummaryUpdatedPayload {
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly timestamp: number;
}

/**
 * Payload for shared note created event.
 */
export interface SharedNoteCreatedPayload {
  readonly workspaceId: string;
  readonly noteId: string;
  readonly advisorId: string;
  readonly noteType: string;
  readonly timestamp: number;
}

/**
 * Payload for review requested/completed events.
 */
export interface ReviewEventPayload {
  readonly workspaceId: string;
  readonly reviewId: string;
  readonly requesterId: string;
  readonly reviewerId: string;
  readonly timestamp: number;
}

/**
 * Payload for conversation exported/imported events.
 */
export interface ConversationTransferPayload {
  readonly workspaceId: string;
  readonly timestamp: number;
}

/**
 * Type guard for conversation events.
 */
export function isConversationEvent(event: Event<unknown>): event is Event<ConversationEventPayloads> {
  return Object.values(ConversationEvents).includes(event.type as ConversationEventName);
}

/**
 * Union of all conversation event payloads.
 */
export type ConversationEventPayloads =
  | WorkspaceCreatedPayload
  | WorkspaceClosedPayload
  | AdvisorStateChangedPayload
  | SessionLifecyclePayload
  | SessionSwitchedPayload
  | SnapshotCreatedPayload
  | SummaryUpdatedPayload
  | SharedNoteCreatedPayload
  | ReviewEventPayload
  | ConversationTransferPayload;

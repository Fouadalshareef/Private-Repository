import type { CollaborationRequest } from './CollaborationRequest.js';
import type { SharedNote } from './SharedNotes.js';

/**
 * An inbox for an advisor containing pending items.
 */
export interface AdvisorInbox {
  readonly advisorId: string;
  readonly workspaceId: string;
  readonly incomingReviews: readonly CollaborationRequest[];
  readonly architectureRequests: readonly CollaborationRequest[];
  readonly questions: readonly CollaborationRequest[];
  readonly sharedNotes: readonly SharedNote[];
  readonly pendingTasks: readonly { readonly taskId: string; readonly description: string }[];
  readonly updatedAt: number;
}

/**
 * Creates a frozen AdvisorInbox instance.
 */
export function createAdvisorInbox(inbox: AdvisorInbox): AdvisorInbox {
  return Object.freeze({
    ...inbox,
    incomingReviews: Object.freeze([...inbox.incomingReviews]),
    architectureRequests: Object.freeze([...inbox.architectureRequests]),
    questions: Object.freeze([...inbox.questions]),
    sharedNotes: Object.freeze([...inbox.sharedNotes]),
    pendingTasks: Object.freeze([...inbox.pendingTasks]),
  });
}

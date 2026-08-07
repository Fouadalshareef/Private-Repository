/**
 * Status of a conversation session.
 */
export enum ConversationSessionStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CLOSED = 'closed',
}

/**
 * Status of an advisor within a workspace.
 */
export enum AdvisorStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  OFFLINE = 'offline',
}

/**
 * Type of shared note.
 */
export enum SharedNoteType {
  RECOMMENDATION = 'recommendation',
  DECISION = 'decision',
  WARNING = 'warning',
  TODO = 'todo',
  QUESTION = 'question',
}

/**
 * Status of a collaboration request.
 */
export enum CollaborationRequestStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

/**
 * Resolution of a review.
 */
export enum ReviewResolution {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CHANGES_REQUESTED = 'changes_requested',
}

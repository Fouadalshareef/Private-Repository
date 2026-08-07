/**
 * A request for one advisor to review another's work.
 */
export interface CollaborationRequest {
  readonly requestId: string;
  readonly workspaceId: string;
  readonly requesterId: string;
  readonly reviewerId: string;
  readonly subject: string;
  readonly description: string;
  readonly status: string;
  readonly resolution?: 'approved' | 'rejected' | 'changes_requested';
  readonly feedback?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/**
 * Creates a frozen CollaborationRequest instance.
 */
export function createCollaborationRequest(request: CollaborationRequest): CollaborationRequest {
  return Object.freeze({
    ...request,
  });
}

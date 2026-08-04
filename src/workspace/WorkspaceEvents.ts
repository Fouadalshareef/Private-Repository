/**
 * Event type names for workspace lifecycle events.
 *
 * These are definitions only — events are not published yet. They are
 * reserved for future integration with the Event Bus.
 */
export const WorkspaceEvents = {
  /** Published when a workspace is created. */
  WORKSPACE_CREATED: 'workspace.created',

  /** Published when a workspace is opened. */
  WORKSPACE_OPENED: 'workspace.opened',

  /** Published when a workspace is closed. */
  WORKSPACE_CLOSED: 'workspace.closed',

  /** Published when a workspace encounters an error. */
  WORKSPACE_ERROR: 'workspace.error',
} as const;

/**
 * Represents the type of workspace lifecycle events.
 */
export type WorkspaceEventType = (typeof WorkspaceEvents)[keyof typeof WorkspaceEvents];
/**
 * Defines the lifecycle states of a workspace.
 *
 * - `closed`: The workspace has been created but is not open, or has
 *   been closed. Opening is valid from this state.
 * - `opening`: The workspace is in the process of opening. Reserved for
 *   future use when asynchronous opening (e.g., filesystem scans) is
 *   introduced.
 * - `open`: The workspace is open and operational.
 * - `closing`: The workspace is in the process of closing. Reserved for
 *   future use when asynchronous closing is introduced.
 * - `error`: The workspace has encountered an error. Reserved for
 *   future use when error recovery workflows are introduced.
 */
export enum WorkspaceState {
  CLOSED = 'closed',
  OPENING = 'opening',
  OPEN = 'open',
  CLOSING = 'closing',
  ERROR = 'error',
}
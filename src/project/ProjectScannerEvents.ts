/**
 * Event type names for project scanner lifecycle events.
 *
 * These are definitions only — events are not published yet. They are
 * reserved for future integration with the Event Bus.
 */
export const ProjectScannerEvents = {
  /** Published when a project scan starts. */
  SCAN_STARTED: 'project.scan.started',

  /** Published when a project scan completes. */
  SCAN_COMPLETED: 'project.scan.completed',

  /** Published when a project scan fails. */
  SCAN_FAILED: 'project.scan.failed',
} as const;

/**
 * Represents the type of project scanner lifecycle events.
 */
export type ProjectScannerEventType =
  (typeof ProjectScannerEvents)[keyof typeof ProjectScannerEvents];
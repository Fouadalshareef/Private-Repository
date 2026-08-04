/**
 * Event type names for source index lifecycle events.
 *
 * These are definitions only — events are not published yet. They are
 * reserved for future integration with the Event Bus.
 */
export const SourceIndexEvents = {
  /** Published when a source index is built. */
  INDEX_BUILT: 'source.index.built',

  /** Published when a source index is updated. */
  INDEX_UPDATED: 'source.index.updated',

  /** Published when a source index is cleared. */
  INDEX_CLEARED: 'source.index.cleared',
} as const;

/**
 * Represents the type of source index lifecycle events.
 */
export type SourceIndexEventType =
  (typeof SourceIndexEvents)[keyof typeof SourceIndexEvents];
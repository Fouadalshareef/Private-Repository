/**
 * Event type names for Project Object Model lifecycle events.
 *
 * These are definitions only — events are not published yet. They are
 * reserved for future integration with the Event Bus.
 */
export const ProjectModelEvents = {
  /** Published when a project model is created. */
  MODEL_CREATED: 'project.model.created',

  /** Published when a project model is updated. */
  MODEL_UPDATED: 'project.model.updated',

  /** Published when a project model is removed. */
  MODEL_REMOVED: 'project.model.removed',
} as const;

/**
 * Represents the type of project model lifecycle events.
 */
export type ProjectModelEventType =
  (typeof ProjectModelEvents)[keyof typeof ProjectModelEvents];
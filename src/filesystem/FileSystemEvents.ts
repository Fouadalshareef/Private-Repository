/**
 * Event type names for file system lifecycle events.
 *
 * These are definitions only — events are not published yet. They are
 * reserved for future integration with the Event Bus.
 */
export const FileSystemEvents = {
  /** Published when a file is created. */
  FILE_CREATED: 'filesystem.file.created',

  /** Published when a file is updated. */
  FILE_UPDATED: 'filesystem.file.updated',

  /** Published when a file is deleted. */
  FILE_DELETED: 'filesystem.file.deleted',

  /** Published when a directory is created. */
  DIRECTORY_CREATED: 'filesystem.directory.created',

  /** Published when a directory is deleted. */
  DIRECTORY_DELETED: 'filesystem.directory.deleted',
} as const;

/**
 * Represents the type of file system lifecycle events.
 */
export type FileSystemEventType = (typeof FileSystemEvents)[keyof typeof FileSystemEvents];
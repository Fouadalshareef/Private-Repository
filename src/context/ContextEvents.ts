/**
 * Event name constants for context management lifecycle events.
 */
export const ContextEvents = {
  /** Emitted when a new conversation session is created. */
  SESSION_CREATED: 'context.session.created',
  /** Emitted when a conversation session is deleted. */
  SESSION_DELETED: 'context.session.deleted',
  /** Emitted when messages are added to a session. */
  MESSAGES_ADDED: 'context.messages.added',
  /** Emitted when context window is trimmed. */
  CONTEXT_TRIMMED: 'context.trimmed',
  /** Emitted when context window overflows. */
  CONTEXT_OVERFLOW: 'context.overflow',
  /** Emitted when a session is cleared. */
  SESSION_CLEARED: 'context.session.cleared',
} as const;

/**
 * Type for context event names.
 */
export type ContextEventName = typeof ContextEvents[keyof typeof ContextEvents];
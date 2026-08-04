/**
 * Event name constants for AI provider lifecycles.
 */
export const AIProviderEvents = {
  /** Emitted when a completion request starts. */
  COMPLETION_STARTED: 'ai.provider.completion.started',
  /** Emitted when a completion request finishes successfully. */
  COMPLETION_FINISHED: 'ai.provider.completion.finished',
  /** Emitted when a completion request fails. */
  COMPLETION_FAILED: 'ai.provider.completion.failed',
  /** Emitted when a streaming chunk is received. */
  STREAM_CHUNK: 'ai.provider.stream.chunk',
  /** Emitted when a streaming session starts. */
  STREAM_STARTED: 'ai.provider.stream.started',
  /** Emitted when a streaming session ends. */
  STREAM_ENDED: 'ai.provider.stream.ended',
  /** Emitted when a streaming session fails. */
  STREAM_FAILED: 'ai.provider.stream.failed',
  /** Emitted when a provider is registered. */
  PROVIDER_REGISTERED: 'ai.provider.registered',
  /** Emitted when a provider is unregistered. */
  PROVIDER_UNREGISTERED: 'ai.provider.unregistered',
} as const;

/**
 * Type for AI provider event names.
 */
export type AIProviderEventName = typeof AIProviderEvents[keyof typeof AIProviderEvents];
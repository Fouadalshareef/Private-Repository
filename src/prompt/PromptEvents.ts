
/**
 * Event name constants for prompt lifecycle events.
 */
export const PromptEvents = {
  /** Emitted when a template is rendered. */
  TEMPLATE_RENDERED: 'prompt.template.rendered',
  /** Emitted when a template rendering fails. */
  TEMPLATE_RENDER_FAILED: 'prompt.template.render_failed',
  /** Emitted when variables are validated. */
  VARIABLES_VALIDATED: 'prompt.variables.validated',
  /** Emitted when variable validation fails. */
  VARIABLE_VALIDATION_FAILED: 'prompt.variables.validation_failed',
  /** Emitted when a prompt is truncated due to token limits. */
  PROMPT_TRUNCATED: 'prompt.truncated',
  /** Emitted when a prompt exceeds token limits. */
  PROMPT_EXCEEDS_LIMIT: 'prompt.exceeds_limit',
} as const;

/**
 * Type for prompt event names.
 */
export type PromptEventName = typeof PromptEvents[keyof typeof PromptEvents];
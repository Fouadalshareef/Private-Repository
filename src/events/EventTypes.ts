/**
 * Represents the fundamental structure of an event in the system.
 * @template TPayload The type of the payload associated with the event.
 */
export interface Event<TPayload = unknown> {
  /** The type or name of the event. */
  type: string;
  /** The time the event occurred as a Unix timestamp. */
  timestamp: number;
  /** The data associated with the event. */
  payload: TPayload;
}

/**
 * Defines the signature for a function that handles an event.
 * @template TPayload The type of the payload expected by the handler.
 */
export type EventHandler<TPayload = unknown> = (event: Event<TPayload>) => void;

import type { Event, EventHandler } from './EventTypes.js';

/**
 * Defines the contract for an Event Bus.
 */
export interface IEventBus {
  /**
   * Publishes an event to all subscribers synchronously.
   * @param event The event to publish.
   */
  publish<TPayload = unknown>(event: Event<TPayload>): void;

  /**
   * Subscribes a handler to a specific event type.
   * @param eventType The type of the event to listen for.
   * @param handler The function to call when the event is published.
   */
  subscribe<TPayload = unknown>(eventType: string, handler: EventHandler<TPayload>): void;

  /**
   * Unsubscribes a specific handler from an event type.
   * @param eventType The type of the event.
   * @param handler The handler to remove.
   */
  unsubscribe<TPayload = unknown>(eventType: string, handler: EventHandler<TPayload>): void;

  /**
   * Clears all subscribers for all event types.
   */
  clear(): void;
}

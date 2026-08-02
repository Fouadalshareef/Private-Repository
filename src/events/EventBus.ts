import type { Event, EventHandler } from './EventTypes.js';
import type { IEventBus } from './IEventBus.js';

/**
 * A synchronous implementation of the IEventBus interface.
 */
export class EventBus implements IEventBus {
  private subscribers: Map<string, Set<EventHandler<unknown>>>;

  constructor() {
    this.subscribers = new Map<string, Set<EventHandler<unknown>>>();
  }

  /**
   * Publishes an event to all subscribers synchronously.
   * @param event The event to publish.
   */
  public publish<TPayload = unknown>(event: Event<TPayload>): void {
    const handlers = this.subscribers.get(event.type);
    if (!handlers) {
      return;
    }

    // Iterate over a copy of the handlers to prevent issues if subscribers
    // are modified during dispatch (e.g. unsubscribing inside a handler).
    const handlersCopy = Array.from(handlers);
    for (const handler of handlersCopy) {
      (handler as unknown as EventHandler<TPayload>)(event);
    }
  }

  /**
   * Subscribes a handler to a specific event type.
   * @param eventType The type of the event to listen for.
   * @param handler The function to call when the event is published.
   */
  public subscribe<TPayload = unknown>(eventType: string, handler: EventHandler<TPayload>): void {
    let handlers = this.subscribers.get(eventType);
    if (!handlers) {
      handlers = new Set<EventHandler<unknown>>();
      this.subscribers.set(eventType, handlers);
    }
    handlers.add(handler as unknown as EventHandler<unknown>);
  }

  /**
   * Unsubscribes a specific handler from an event type.
   * @param eventType The type of the event.
   * @param handler The handler to remove.
   */
  public unsubscribe<TPayload = unknown>(eventType: string, handler: EventHandler<TPayload>): void {
    const handlers = this.subscribers.get(eventType);
    if (handlers) {
      handlers.delete(handler as unknown as EventHandler<unknown>);
      if (handlers.size === 0) {
        this.subscribers.delete(eventType);
      }
    }
  }

  /**
   * Clears all subscribers for all event types.
   */
  public clear(): void {
    this.subscribers.clear();
  }
}

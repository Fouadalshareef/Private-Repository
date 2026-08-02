import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../src/events/EventBus.js';
import type { Event } from '../src/events/EventTypes.js';

describe('EventBus', () => {
  it('should publish an event to a subscriber', () => {
    const eventBus = new EventBus();
    const handler = vi.fn();

    eventBus.subscribe('USER_CREATED', handler);

    const event: Event<{ id: number }> = {
      type: 'USER_CREATED',
      timestamp: Date.now(),
      payload: { id: 1 },
    };

    eventBus.publish(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should not throw if publishing an event with no subscribers', () => {
    const eventBus = new EventBus();
    const event: Event = { type: 'NO_SUBSCRIBER', timestamp: Date.now(), payload: null };

    expect(() => eventBus.publish(event)).not.toThrow();
  });

  it('should handle multiple subscribers for the same event type', () => {
    const eventBus = new EventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    eventBus.subscribe('TEST_EVENT', handler1);
    eventBus.subscribe('TEST_EVENT', handler2);

    const event: Event = { type: 'TEST_EVENT', timestamp: Date.now(), payload: null };
    eventBus.publish(event);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should not notify unsubscribed handlers', () => {
    const eventBus = new EventBus();
    const handler = vi.fn();

    eventBus.subscribe('TEST_EVENT', handler);
    eventBus.unsubscribe('TEST_EVENT', handler);

    const event: Event = { type: 'TEST_EVENT', timestamp: Date.now(), payload: null };
    eventBus.publish(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should correctly clear all subscribers', () => {
    const eventBus = new EventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    eventBus.subscribe('EVENT_A', handler1);
    eventBus.subscribe('EVENT_B', handler2);

    eventBus.clear();

    const eventA: Event = { type: 'EVENT_A', timestamp: Date.now(), payload: null };
    const eventB: Event = { type: 'EVENT_B', timestamp: Date.now(), payload: null };

    eventBus.publish(eventA);
    eventBus.publish(eventB);

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('should ignore unsubscribing a handler that is not subscribed safely', () => {
    const eventBus = new EventBus();
    const handler = vi.fn();

    expect(() => eventBus.unsubscribe('NOT_EXIST', handler)).not.toThrow();
  });
});

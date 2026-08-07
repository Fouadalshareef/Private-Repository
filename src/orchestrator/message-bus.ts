import { EventEmitter } from 'events';
import type { IEventBus } from '../events/IEventBus.js';

/**
 * Message Bus for inter-agent communication.
 *
 * All communication between agents must go through this unified message bus.
 * This ensures traceability and allows the Arbiter to intercept and resolve conflicts.
 */
export class MessageBus extends EventEmitter implements IEventBus {
  private readonly messageHistory: Array<{ type: string; payload: unknown; timestamp: number }> = [];
  private readonly maxHistorySize = 1000;

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Publishes a message to all subscribers.
   */
  public publish(event: { type: string; timestamp: number; payload: unknown }): void {
    // Store in history
    this.messageHistory.push({
      type: event.type,
      payload: event.payload,
      timestamp: event.timestamp,
    });

    // Trim history if needed
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }

    // Emit to all listeners
    this.emit(event.type, event.payload);
  }

  /**
   * Subscribes to a specific event type.
   */
  public subscribe(eventType: string, handler: (payload: unknown) => void): () => void {
    this.on(eventType, handler);
    return () => this.off(eventType, handler);
  }

  /**
   * Gets message history for debugging/replay.
   */
  public getHistory(eventType?: string): readonly { type: string; payload: unknown; timestamp: number }[] {
    if (eventType) {
      return this.messageHistory.filter((m) => m.type === eventType);
    }
    return [...this.messageHistory];
  }

  /**
   * Clears message history.
   */
  public clearHistory(): void {
    this.messageHistory.length = 0;
  }
}
import type { ConversationSummary } from './ConversationSummary.js';

/**
 * A snapshot of a conversation session at a point in time.
 */
export interface ConversationSnapshot {
  readonly snapshotId: string;
  readonly sessionId: string;
  readonly advisorId: string;
  readonly messages: readonly unknown[];
  readonly summary: ConversationSummary;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: number;
}

/**
 * Creates a frozen ConversationSnapshot instance.
 */
export function createConversationSnapshot(snapshot: ConversationSnapshot): ConversationSnapshot {
  return Object.freeze({
    ...snapshot,
    messages: Object.freeze([...snapshot.messages]),
    summary: Object.freeze({ ...snapshot.summary }),
    metadata: Object.freeze({ ...snapshot.metadata }),
  });
}

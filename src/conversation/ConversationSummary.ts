/**
 * A summary of a conversation session.
 */
export interface ConversationSummary {
  readonly summaryId: string;
  readonly sessionId: string;
  readonly advisorId: string;
  readonly content: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/**
 * Creates a frozen ConversationSummary instance.
 */
export function createConversationSummary(summary: ConversationSummary): ConversationSummary {
  return Object.freeze({
    ...summary,
  });
}

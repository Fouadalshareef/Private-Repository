/**
 * Represents the role of a message in a conversation.
 */
export enum MessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  TOOL = 'tool',
}

/**
 * Represents a message in a conversation with an AI provider.
 */
export interface AIMessage {
  /** The role of the message sender. */
  readonly role: MessageRole;
  /** The content of the message. */
  readonly content: string;
  /** Optional name identifier for the message (useful for tool calls). */
  readonly name?: string;
  /** Optional tool call ID for tool responses. */
  readonly toolCallId?: string;
}

/**
 * Creates a new AIMessage with the specified role and content.
 */
export function createAIMessage(
  role: MessageRole,
  content: string,
  options?: { name?: string; toolCallId?: string },
): AIMessage {
  return {
    role,
    content,
    ...(options?.name !== undefined && { name: options.name }),
    ...(options?.toolCallId !== undefined && { toolCallId: options.toolCallId }),
  };
}

/**
 * Creates a system message.
 */
export function systemMessage(content: string): AIMessage {
  return createAIMessage(MessageRole.SYSTEM, content);
}

/**
 * Creates a user message.
 */
export function userMessage(content: string): AIMessage {
  return createAIMessage(MessageRole.USER, content);
}

/**
 * Creates an assistant message.
 */
export function assistantMessage(content: string): AIMessage {
  return createAIMessage(MessageRole.ASSISTANT, content);
}

/**
 * Creates a tool message.
 */
export function toolMessage(content: string, toolCallId: string): AIMessage {
  return createAIMessage(MessageRole.TOOL, content, { toolCallId });
}
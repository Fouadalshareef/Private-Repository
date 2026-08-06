import type { AIMessage } from '../ai/AIMessage.js';
import type { IContextWindowStrategy } from './IContextWindowStrategy.js';

/**
 * Represents a conversation session with message history.
 */
export interface ConversationSession {
  /** Unique identifier for the session. */
  readonly sessionId: string;
  /** Messages in the conversation history. */
  readonly messages: readonly AIMessage[];
  /** Timestamp when the session was created. */
  readonly createdAt: Date;
  /** Timestamp when the session was last updated. */
  readonly updatedAt: Date;
  /** Optional metadata for the session. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Options for creating a new conversation session.
 */
export interface CreateSessionOptions {
  /** Optional metadata for the session. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Options for adding messages to a session.
 */
export interface AddMessageOptions {
  /** Whether to trim the session after adding messages. */
  readonly trimAfterAdd?: boolean;
}

/**
 * Result of trimming a conversation session.
 */
export interface TrimResult {
  /** The trimmed messages. */
  readonly messages: readonly AIMessage[];
  /** Number of messages removed. */
  readonly removedCount: number;
  /** Whether the session was trimmed. */
  readonly trimmed: boolean;
}

/**
 * Core interface for managing conversation memory.
 */
export interface IConversationMemory {
  /**
   * Creates a new conversation session.
   */
  createSession(sessionId: string, options?: CreateSessionOptions): ConversationSession;

  /**
   * Retrieves a conversation session by ID.
   */
  getSession(sessionId: string): ConversationSession | undefined;

  /**
   * Adds a message to a conversation session.
   */
  addMessage(sessionId: string, message: AIMessage, options?: AddMessageOptions): void;

  /**
   * Adds multiple messages to a conversation session.
   */
  addMessages(sessionId: string, messages: readonly AIMessage[], options?: AddMessageOptions): void;

  /**
   * Trims messages in a session using a strategy.
   */
  trimSession?(sessionId: string, strategy: IContextWindowStrategy, maxTokens: number): TrimResult;

  /**
   * Clears all messages from a session.
   */
  clearSession(sessionId: string): void;

  /**
   * Deletes a conversation session.
   */
  deleteSession(sessionId: string): void;

  /**
   * Returns all session IDs.
   */
  getSessionIds(): readonly string[];

  /**
   * Returns the number of active sessions.
   */
  get sessionCount(): number;
}
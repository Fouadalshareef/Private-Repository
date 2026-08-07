import type { AIMessage } from '../ai/AIMessage.js';
import type { IConversationMemory, ConversationSession, CreateSessionOptions, AddMessageOptions, TrimResult } from './IConversationMemory.js';
import type { IContextWindowStrategy } from './IContextWindowStrategy.js';
import { InvalidConversationSessionError } from './ContextError.js';

/**
 * Core implementation of conversation memory management.
 */
export class ConversationMemory implements IConversationMemory {
  private readonly sessions: Map<string, ConversationSession> = new Map();
  private readonly defaultStrategy?: IContextWindowStrategy;
  private readonly defaultMaxTokens?: number;

  constructor(defaultStrategy?: IContextWindowStrategy, defaultMaxTokens?: number) {
    this.defaultStrategy = defaultStrategy;
    this.defaultMaxTokens = defaultMaxTokens;
  }

  /**
   * Creates a new conversation session.
   */
  createSession(sessionId: string, options?: CreateSessionOptions): ConversationSession {
    if (this.sessions.has(sessionId)) {
      throw new InvalidConversationSessionError(sessionId);
    }

    const now = new Date();
    const session: ConversationSession = {
      sessionId,
      messages: [],
      createdAt: now,
      updatedAt: now,
      ...(options?.metadata ? { metadata: options.metadata } : {}),
    };

    this.sessions.set(sessionId, session);
    return this.getSession(sessionId)!;
  }

  /**
   * Retrieves a conversation session by ID.
   */
  getSession(sessionId: string): ConversationSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }
    // Return a fully immutable copy with cloned Date objects
    return Object.freeze({
      sessionId: session.sessionId,
      messages: Object.freeze([...session.messages]),
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
      ...(session.metadata ? { metadata: Object.freeze({ ...session.metadata }) } : {}),
    });
  }

  /**
   * Adds a message to a conversation session.
   */
  addMessage(sessionId: string, message: AIMessage, options?: AddMessageOptions): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new InvalidConversationSessionError(sessionId);
    }

    const frozenMessage = Object.freeze({ ...message });
    const updatedSession: ConversationSession = {
      ...session,
      messages: [...session.messages, frozenMessage],
      updatedAt: new Date(),
    };

    this.sessions.set(sessionId, updatedSession);

    if (options?.trimAfterAdd && this.defaultStrategy && this.defaultMaxTokens !== undefined) {
      this.trimSession(sessionId, this.defaultStrategy, this.defaultMaxTokens);
    }
  }

  /**
   * Adds multiple messages to a conversation session.
   */
  addMessages(sessionId: string, messages: readonly AIMessage[], options?: AddMessageOptions): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new InvalidConversationSessionError(sessionId);
    }

    const frozenMessages = messages.map((m) => Object.freeze({ ...m }));
    const updatedSession: ConversationSession = {
      ...session,
      messages: [...session.messages, ...frozenMessages],
      updatedAt: new Date(),
    };

    this.sessions.set(sessionId, updatedSession);

    if (options?.trimAfterAdd && this.defaultStrategy && this.defaultMaxTokens !== undefined) {
      this.trimSession(sessionId, this.defaultStrategy, this.defaultMaxTokens);
    }
  }

  /**
   * Trims messages in a session using a context window strategy.
   */
  trimSession(sessionId: string, strategy: IContextWindowStrategy, maxTokens: number): TrimResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new InvalidConversationSessionError(sessionId);
    }

    const result = strategy.trim(session.messages, maxTokens);
    if (result.trimmed) {
      const updatedSession: ConversationSession = {
        ...session,
        messages: result.messages,
        updatedAt: new Date(),
      };
      this.sessions.set(sessionId, updatedSession);
    }

    return result;
  }

  /**
   * Clears all messages from a session.
   */
  clearSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new InvalidConversationSessionError(sessionId);
    }

    const clearedSession: ConversationSession = {
      ...session,
      messages: [],
      updatedAt: new Date(),
    };

    this.sessions.set(sessionId, clearedSession);
  }

  /**
   * Deletes a conversation session.
   */
  deleteSession(sessionId: string): void {
    if (!this.sessions.has(sessionId)) {
      throw new InvalidConversationSessionError(sessionId);
    }
    this.sessions.delete(sessionId);
  }

  /**
   * Returns all session IDs.
   */
  getSessionIds(): readonly string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Returns the number of active sessions.
   */
  get sessionCount(): number {
    return this.sessions.size;
  }
}
import { describe, it, expect } from 'vitest';
import { ConversationMemory } from '../src/context/ConversationMemory.js';
import { ContextWindowStrategy } from '../src/context/ContextWindowStrategy.js';
import { InvalidConversationSessionError, ContextWindowOverflowError } from '../src/context/ContextError.js';
import { MessageRole } from '../src/ai/AIMessage.js';

describe('ConversationMemory', () => {
  it('should create a new session', () => {
    const memory = new ConversationMemory();
    const session = memory.createSession('session-1');
    
    expect(session.sessionId).toBe('session-1');
    expect(session.messages).toEqual([]);
    expect(memory.sessionCount).toBe(1);
  });

  it('should throw when creating duplicate session', () => {
    const memory = new ConversationMemory();
    memory.createSession('session-1');
    
    expect(() => memory.createSession('session-1')).toThrow(InvalidConversationSessionError);
  });

  it('should retrieve a session', () => {
    const memory = new ConversationMemory();
    memory.createSession('session-1');
    const session = memory.getSession('session-1');
    
    expect(session).toBeDefined();
    expect(session?.sessionId).toBe('session-1');
  });

  it('should return undefined for non-existent session', () => {
    const memory = new ConversationMemory();
    const session = memory.getSession('nonexistent');
    
    expect(session).toBeUndefined();
  });

  it('should add a message to a session', () => {
    const memory = new ConversationMemory();
    memory.createSession('session-1');
    memory.addMessage('session-1', {
      role: MessageRole.USER,
      content: 'Hello',
    });
    
    const session = memory.getSession('session-1');
    expect(session?.messages).toHaveLength(1);
    expect(session?.messages[0].content).toBe('Hello');
  });

  it('should throw when adding message to non-existent session', () => {
    const memory = new ConversationMemory();
    
    expect(() => memory.addMessage('nonexistent', {
      role: MessageRole.USER,
      content: 'Hello',
    })).toThrow(InvalidConversationSessionError);
  });

  it('should add multiple messages to a session', () => {
    const memory = new ConversationMemory();
    memory.createSession('session-1');
    memory.addMessages('session-1', [
      { role: MessageRole.USER, content: 'Hello' },
      { role: MessageRole.ASSISTANT, content: 'Hi' },
    ]);
    
    const session = memory.getSession('session-1');
    expect(session?.messages).toHaveLength(2);
  });

  it('should clear a session', () => {
    const memory = new ConversationMemory();
    memory.createSession('session-1');
    memory.addMessage('session-1', { role: MessageRole.USER, content: 'Hello' });
    memory.clearSession('session-1');
    
    const session = memory.getSession('session-1');
    expect(session?.messages).toHaveLength(0);
  });

  it('should delete a session', () => {
    const memory = new ConversationMemory();
    memory.createSession('session-1');
    memory.deleteSession('session-1');
    
    expect(memory.sessionCount).toBe(0);
    expect(memory.getSession('session-1')).toBeUndefined();
  });

  it('should return all session IDs', () => {
    const memory = new ConversationMemory();
    memory.createSession('session-1');
    memory.createSession('session-2');
    memory.createSession('session-3');
    
    const ids = memory.getSessionIds();
    expect(ids).toHaveLength(3);
    expect(ids).toContain('session-1');
    expect(ids).toContain('session-2');
    expect(ids).toContain('session-3');
  });

  it('should maintain session isolation', () => {
    const memory = new ConversationMemory();
    memory.createSession('session-1');
    memory.createSession('session-2');
    
    memory.addMessage('session-1', { role: MessageRole.USER, content: 'Hello from 1' });
    memory.addMessage('session-2', { role: MessageRole.USER, content: 'Hello from 2' });
    
    const session1 = memory.getSession('session-1');
    const session2 = memory.getSession('session-2');
    
    expect(session1?.messages[0].content).toBe('Hello from 1');
    expect(session2?.messages[0].content).toBe('Hello from 2');
  });

  it('should create session with metadata', () => {
    const memory = new ConversationMemory();
    const session = memory.createSession('session-1', { metadata: { user: 'Alice' } });
    
    expect(session.sessionId).toBe('session-1');
    expect(session.metadata).toEqual({ user: 'Alice' });
  });

  it('should trim session messages directly', () => {
    const memory = new ConversationMemory();
    const strategy = new ContextWindowStrategy();
    memory.createSession('session-1');
    memory.addMessages('session-1', [
      { role: MessageRole.SYSTEM, content: 'System' },
      { role: MessageRole.USER, content: 'a'.repeat(100) },
      { role: MessageRole.ASSISTANT, content: 'b'.repeat(100) },
    ]);

    const result = memory.trimSession('session-1', strategy, 30);
    expect(result.trimmed).toBe(true);
    expect(memory.getSession('session-1')?.messages).toHaveLength(result.messages.length);
  });

  it('should trim session automatically on addMessage when default strategy is provided', () => {
    const strategy = new ContextWindowStrategy();
    const memory = new ConversationMemory(strategy, 30);
    memory.createSession('session-1');
    memory.addMessage('session-1', { role: MessageRole.SYSTEM, content: 'System' });
    memory.addMessage('session-1', { role: MessageRole.USER, content: 'a'.repeat(100) });
    memory.addMessage('session-1', { role: MessageRole.ASSISTANT, content: 'b'.repeat(100) }, { trimAfterAdd: true });

    const session = memory.getSession('session-1');
    expect(session?.messages.length).toBeLessThan(3);
    expect(session?.messages[0].role).toBe('system');
  });

  it('should throw error when trimming non-existent session', () => {
    const memory = new ConversationMemory();
    const strategy = new ContextWindowStrategy();
    expect(() => memory.trimSession('nonexistent', strategy, 100)).toThrow(InvalidConversationSessionError);
  });

  it('should return read-only message arrays', () => {
    const memory = new ConversationMemory();
    memory.createSession('session-1');
    memory.addMessage('session-1', { role: MessageRole.USER, content: 'Hello' });
    
    const session = memory.getSession('session-1');
    expect(Object.isFrozen(session?.messages)).toBe(true);
  });
});

describe('ContextWindowStrategy', () => {
  it('should not trim messages within budget', () => {
    const strategy = new ContextWindowStrategy();
    const messages = [
      { role: MessageRole.SYSTEM, content: 'You are a helpful assistant.' },
      { role: MessageRole.USER, content: 'Hello' },
    ];
    
    const result = strategy.trim(messages, 1000);
    expect(result.trimmed).toBe(false);
    expect(result.removedCount).toBe(0);
    expect(result.messages).toHaveLength(2);
  });

  it('should trim messages exceeding budget', () => {
    const strategy = new ContextWindowStrategy();
    const messages = [
      { role: MessageRole.SYSTEM, content: 'System' },
      { role: MessageRole.USER, content: 'a'.repeat(100) },
      { role: MessageRole.ASSISTANT, content: 'b'.repeat(100) },
      { role: MessageRole.USER, content: 'c'.repeat(100) },
    ];
    
    const result = strategy.trim(messages, 50);
    expect(result.trimmed).toBe(true);
    expect(result.removedCount).toBeGreaterThan(0);
  });

  it('should preserve system messages when trimming', () => {
    const strategy = new ContextWindowStrategy();
    const messages = [
      { role: MessageRole.SYSTEM, content: 'System prompt' },
      { role: MessageRole.USER, content: 'a'.repeat(100) },
      { role: MessageRole.ASSISTANT, content: 'b'.repeat(100) },
    ];
    
    const result = strategy.trim(messages, 30);
    expect(result.messages[0].role).toBe('system');
    expect(result.messages[0].content).toBe('System prompt');
  });

  it('should throw error when system messages exceed budget', () => {
    const strategy = new ContextWindowStrategy();
    const messages = [
      { role: MessageRole.SYSTEM, content: 'a'.repeat(1000) },
    ];
    
    expect(() => strategy.trim(messages, 10)).toThrow(ContextWindowOverflowError);
  });

  it('should estimate tokens correctly', () => {
    const strategy = new ContextWindowStrategy();
    const message = { role: MessageRole.USER, content: 'Hello World' };
    
    const tokens = strategy.estimateTokens(message);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should estimate total tokens for multiple messages', () => {
    const strategy = new ContextWindowStrategy();
    const messages = [
      { role: MessageRole.USER, content: 'Hello' },
      { role: MessageRole.ASSISTANT, content: 'Hi' },
    ];
    
    const total = strategy.estimateTotalTokens(messages);
    expect(total).toBeGreaterThan(0);
  });

  it('should trim from oldest messages first', () => {
    const strategy = new ContextWindowStrategy();
    const messages = [
      { role: MessageRole.SYSTEM, content: 'System' },
      { role: MessageRole.USER, content: 'Message 1' },
      { role: MessageRole.ASSISTANT, content: 'Response 1' },
      { role: MessageRole.USER, content: 'Message 2' },
      { role: MessageRole.ASSISTANT, content: 'Response 2' },
    ];
    
    const result = strategy.trim(messages, 30);
    // Should keep system and most recent messages
    expect(result.messages[0].role).toBe('system');
    expect(result.messages[result.messages.length - 1].content).toBe('Response 2');
  });

  it('should return frozen message array', () => {
    const strategy = new ContextWindowStrategy();
    const messages = [
      { role: MessageRole.USER, content: 'Hello' },
    ];
    
    const result = strategy.trim(messages, 1000);
    expect(Object.isFrozen(result.messages)).toBe(true);
  });
});
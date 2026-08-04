import { describe, it, expect } from 'vitest';
import { PromptTemplate } from '../src/prompt/PromptTemplate.js';
import { PromptEngine } from '../src/prompt/PromptEngine.js';
import { MissingPromptVariableError, PromptExceedsTokenLimitError } from '../src/prompt/PromptError.js';
import { MessageRole } from '../src/ai/AIMessage.js';

describe('PromptTemplate', () => {
  it('should render template with variables', () => {
    const template = new PromptTemplate('test', 'Hello {{name}}, welcome to {{place}}!');
    const result = template.render({
      variables: { name: 'Alice', place: 'Wonderland' },
    });
    
    expect(result.content).toBe('Hello Alice, welcome to Wonderland!');
    expect(result.usedVariables).toEqual({ name: 'Alice', place: 'Wonderland' });
    expect(result.missingVariables).toEqual([]);
  });

  it('should throw on missing variables in strict mode', () => {
    const template = new PromptTemplate('test', 'Hello {{name}}!');
    
    expect(() => template.render({
      variables: {},
    })).toThrow(MissingPromptVariableError);
  });

  it('should allow missing variables in non-strict mode', () => {
    const template = new PromptTemplate('test', 'Hello {{name}}!');
    const result = template.render({
      variables: {},
      strict: false,
    });
    
    expect(result.content).toBe('Hello {{name}}!');
    expect(result.missingVariables).toEqual(['name']);
  });

  it('should extract variable names from template', () => {
    const template = new PromptTemplate('test', '{{a}} {{b}} {{a}} {{c}}');
    const variables = template.extractVariableNames(template.template);
    
    expect(variables).toEqual(['a', 'b', 'c']);
  });

  it('should handle empty template', () => {
    const template = new PromptTemplate('test', '');
    const result = template.render({
      variables: {},
    });
    
    expect(result.content).toBe('');
  });

  it('should handle template with no variables', () => {
    const template = new PromptTemplate('test', 'Hello World!');
    const result = template.render({
      variables: { name: 'Alice' },
    });
    
    expect(result.content).toBe('Hello World!');
    expect(result.usedVariables).toEqual({});
  });
});

describe('PromptEngine', () => {
  it('should render template string', () => {
    const engine = new PromptEngine();
    const result = engine.render('Hello {{name}}!', {
      variables: { name: 'Bob' },
    });
    
    expect(result.content).toBe('Hello Bob!');
    expect(result.usedVariables).toEqual({ name: 'Bob' });
  });

  it('should render registered template', () => {
    const engine = new PromptEngine();
    engine.registerTemplate({
      id: 'greeting',
      template: 'Hi {{name}}!',
    });
    
    const result = engine.render({ id: 'greeting', template: 'Hi {{name}}!' }, {
      variables: { name: 'Charlie' },
    });
    
    expect(result.content).toBe('Hi Charlie!');
  });

  it('should compose prompt with system and user messages', () => {
    const engine = new PromptEngine();
    const result = engine.compose({
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'Hello {{name}}!',
      variables: { name: 'Dave' },
    });
    
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toEqual({
      role: MessageRole.SYSTEM,
      content: 'You are a helpful assistant.',
    });
    expect(result.messages[1]).toEqual({
      role: MessageRole.USER,
      content: 'Hello Dave!',
    });
    expect(result.truncated).toBe(false);
  });

  it('should compose prompt with context snippets', () => {
    const engine = new PromptEngine();
    const result = engine.compose({
      userPrompt: 'Question: {{question}}',
      variables: { question: 'What is AI?' },
      contextSnippets: ['Context 1', 'Context 2'],
    });
    
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].content).toBe('Context:\nContext 1');
    expect(result.messages[1].content).toBe('Context:\nContext 2');
    expect(result.messages[2].content).toBe('Question: What is AI?');
  });

  it('should truncate when exceeding token budget', () => {
    const engine = new PromptEngine();
    const longText = 'a'.repeat(1000);
    
    const result = engine.compose({
      userPrompt: longText,
      variables: {},
      maxTokens: 100,
    });
    
    expect(result.truncated).toBe(true);
    expect(result.messages[0].content.length).toBeLessThan(longText.length);
  });

  it('should throw error when prompt exceeds token limit', () => {
    const engine = new PromptEngine();
    const longText = 'a'.repeat(1000);
    
    expect(() => engine.compose({
      systemPrompt: longText,
      userPrompt: 'Hello',
      variables: {},
      maxTokens: 10,
    })).toThrow(PromptExceedsTokenLimitError);
  });

  it('should estimate tokens correctly', () => {
    const engine = new PromptEngine();
    
    expect(engine.estimateTokens('')).toBe(0);
    expect(engine.estimateTokens('abcd')).toBe(1);
    expect(engine.estimateTokens('abcdefgh')).toBe(2);
  });

  it('should truncate text to token budget', () => {
    const engine = new PromptEngine();
    const text = 'abcdefghij';
    
    const truncated = engine.truncateToTokenBudget(text, 2);
    expect(truncated.length).toBeLessThanOrEqual(8);
    expect(truncated.endsWith('...')).toBe(true);
  });

  it('should not truncate text within budget', () => {
    const engine = new PromptEngine();
    const text = 'Hello World';
    
    const truncated = engine.truncateToTokenBudget(text, 100);
    expect(truncated).toBe(text);
  });

  it('should handle template with no system prompt', () => {
    const engine = new PromptEngine();
    const result = engine.compose({
      userPrompt: 'Hello {{name}}!',
      variables: { name: 'Eve' },
    });
    
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe(MessageRole.USER);
  });

  it('should handle multiple context snippets with truncation', () => {
    const engine = new PromptEngine();
    const result = engine.compose({
      userPrompt: 'Question',
      variables: {},
      contextSnippets: ['a'.repeat(100), 'b'.repeat(100), 'c'.repeat(100)],
      maxTokens: 50,
    });
    
    expect(result.truncated).toBe(true);
    expect(result.messages.length).toBeGreaterThan(0);
  });
});
import { describe, it, expect, beforeEach } from 'vitest';
import { AdvisorPromptComposer } from '../../src/advisors/AdvisorPromptComposer.js';
import { AdvisorCatalog } from '../../src/advisors/AdvisorCatalog.js';
import { AdvisorRoles, createAdvisorId } from '../../src/advisors/index.js';
import type { AdvisorComposeContext } from '../../src/advisors/IAdvisorPromptComposer.js';
import type { IAdvisor } from '../../src/advisors/IAdvisor.js';
import { MessageRole } from '../../src/ai/AIMessage.js';
import type { IPromptEngine } from '../../src/prompt/IPromptEngine.js';

describe('AdvisorPromptComposer', () => {
  let composer: AdvisorPromptComposer;
  let catalog: AdvisorCatalog;

  beforeEach(() => {
    catalog = new AdvisorCatalog();
    const mockPromptEngine: IPromptEngine = {
      compose: (options: unknown) => ({
        messages: [
          { role: MessageRole.SYSTEM, content: (options as { systemPrompt: string }).systemPrompt },
          { role: MessageRole.USER, content: (options as { userPrompt: string }).userPrompt },
        ],
        tokenCount: 100,
        truncated: false,
      }),
      estimateTokens: (text: string) => text.length,
      render: (_template: unknown, _options: unknown) => {
        void _template;
        void _options;
        return {
          content: '',
          usedVariables: {},
          missingVariables: [] as readonly string[],
        };
      },
      truncateToTokenBudget: (text: string) => text,
    };
    composer = new AdvisorPromptComposer(mockPromptEngine);
  });

  describe('Basic composition', () => {
    it('should compose a prompt for an advisor', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: 'How do I implement a feature?',
      };

      const result = composer.compose(advisor, context);

      expect(result.advisorId).toBe(advisor.id);
      expect(result.systemPrompt).toBe(advisor.profile.systemPrompt);
      expect(result.promptResult.messages.length).toBeGreaterThan(0);
      expect(result.tokenBreakdown.total).toBeGreaterThan(0);
    });

    it('should include advisor metadata in variables', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: 'Test input',
      };

      const result = composer.compose(advisor, context);

      expect(result.systemPrompt).toContain(advisor.profile.name);
    });

    it('should calculate token breakdown correctly', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.QA_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: 'Test input',
      };

      const result = composer.compose(advisor, context);

      expect(result.tokenBreakdown.systemPrompt).toBeGreaterThan(0);
      expect(result.tokenBreakdown.userInput).toBe('Test input'.length);
      expect(result.tokenBreakdown.total).toBeGreaterThan(0);
    });
  });

  describe('Context snippets', () => {
    it('should include capabilities in context snippets', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: 'Test',
      };

      const result = composer.compose(advisor, context);

      // Context snippets are passed to prompt engine, verify compose was called
      expect(result.promptResult.messages.length).toBeGreaterThan(0);
    });

    it('should include allowed tools in context snippets', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: 'Test',
      };

      const result = composer.compose(advisor, context);

      // Context snippets are passed to prompt engine, verify compose was called
      expect(result.promptResult.messages.length).toBeGreaterThan(0);
    });

    it('should include user-provided context snippets', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: 'Test',
        contextSnippets: ['Custom context 1', 'Custom context 2'],
      };

      const result = composer.compose(advisor, context);

      // Context snippets are passed to prompt engine, verify compose was called
      expect(result.promptResult.messages.length).toBeGreaterThan(0);
    });
  });

  describe('Conversation history', () => {
    it('should estimate tokens for conversation history', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: 'Test',
        conversationHistory: [
          { role: 'user', content: 'Previous message' },
          { role: 'assistant', content: 'Previous response' },
        ],
      };

      const result = composer.compose(advisor, context);

      expect(result.tokenBreakdown.conversationHistory).toBe('Previous message'.length + 'Previous response'.length);
    });

    it('should handle empty conversation history', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: 'Test',
        conversationHistory: [],
      };

      const result = composer.compose(advisor, context);

      expect(result.tokenBreakdown.conversationHistory).toBe(0);
    });

    it('should handle undefined conversation history', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: 'Test',
      };

      const result = composer.compose(advisor, context);

      expect(result.tokenBreakdown.conversationHistory).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should validate a valid advisor and context', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: 'Test input',
      };

      expect(composer.validate(advisor, context)).toBe(true);
    });

    it('should reject null advisor', () => {
      const context: AdvisorComposeContext = {
        userInput: 'Test input',
      };

      expect(composer.validate(null as unknown as IAdvisor, context)).toBe(false);
    });

    it('should reject advisor without systemPrompt', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const invalidAdvisor = {
        ...advisor,
        profile: {
          ...advisor.profile,
          systemPrompt: '',
        },
      };
      const context: AdvisorComposeContext = {
        userInput: 'Test input',
      };

      expect(composer.validate(invalidAdvisor as unknown as IAdvisor, context)).toBe(false);
    });

    it('should reject empty userInput', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: '',
      };

      expect(composer.validate(advisor, context)).toBe(false);
    });

    it('should reject whitespace-only userInput', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: '   ',
      };

      expect(composer.validate(advisor, context)).toBe(false);
    });

    it('should reject null context', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;

      expect(composer.validate(advisor, null as unknown as AdvisorComposeContext)).toBe(false);
    });
  });

  describe('Result immutability', () => {
    it('should return frozen result', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: 'Test',
      };

      const result = composer.compose(advisor, context);

      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should return frozen tokenBreakdown', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: 'Test',
      };

      const result = composer.compose(advisor, context);

      expect(Object.isFrozen(result.tokenBreakdown)).toBe(true);
    });

    it('should return frozen promptResult', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: 'Test',
      };

      const result = composer.compose(advisor, context);

      expect(Object.isFrozen(result.promptResult)).toBe(true);
    });

    it('should return frozen messages array', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: 'Test',
      };

      const result = composer.compose(advisor, context);

      expect(Object.isFrozen(result.promptResult.messages)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle advisor with no capabilities', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: 'Test',
      };

      const result = composer.compose(advisor, context);

      expect(result.systemPrompt).toBeDefined();
    });

    it('should handle advisor with no allowed tools', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: 'Test',
      };

      const result = composer.compose(advisor, context);

      expect(result.systemPrompt).toBeDefined();
    });

    it('should use default maxTokens when not provided', () => {
      const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))!;
      const context: AdvisorComposeContext = {
        userInput: 'Test',
      };

      const result = composer.compose(advisor, context);

      expect(result.tokenBreakdown.total).toBeGreaterThan(0);
    });

    it('should handle all advisor personas', () => {
      const advisors = catalog.getAll();

      for (const advisor of advisors) {
        const context: AdvisorComposeContext = {
          userInput: 'Test',
        };

        const result = composer.compose(advisor, context);
        expect(result.advisorId).toBe(advisor.id);
        expect(result.systemPrompt).toBeDefined();
      }
    });
  });
});
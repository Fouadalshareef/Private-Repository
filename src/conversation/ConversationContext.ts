/**
 * Shared project context accessible to all advisors in a workspace.
 */
export interface ConversationContext {
  readonly contextId: string;
  readonly workspaceId: string;
  readonly projectName: string;
  readonly repository?: string;
  readonly currentTask?: string;
  readonly currentSprint?: string;
  readonly currentBranch?: string;
  readonly architectureNotes: readonly string[];
  readonly importantFiles: readonly string[];
  readonly openDecisions: readonly string[];
  readonly codingRules: readonly string[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

/**
 * Creates a frozen ConversationContext instance.
 */
export function createConversationContext(context: ConversationContext): ConversationContext {
  return Object.freeze({
    ...context,
    architectureNotes: Object.freeze([...context.architectureNotes]),
    importantFiles: Object.freeze([...context.importantFiles]),
    openDecisions: Object.freeze([...context.openDecisions]),
    codingRules: Object.freeze([...context.codingRules]),
  });
}

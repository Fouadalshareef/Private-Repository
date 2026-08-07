import type { ConversationSessionStatus } from './ConversationState.js';

/**
 * Represents an advisor's private session within a workspace.
 */
export interface AdvisorSession {
  readonly sessionId: string;
  readonly workspaceId: string;
  readonly advisorId: string;
  readonly messages: readonly unknown[];
  readonly summary?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly status: ConversationSessionStatus;
  readonly lastActivity: number;
}

/**
 * Creates a frozen AdvisorSession instance.
 */
export function createAdvisorSession(session: AdvisorSession): AdvisorSession {
  return Object.freeze({
    ...session,
    messages: Object.freeze([...session.messages]),
    metadata: Object.freeze({ ...session.metadata }),
  });
}

import type { SharedNoteType } from './ConversationState.js';

/**
 * A shared note created by an advisor.
 */
export interface SharedNote {
  readonly noteId: string;
  readonly workspaceId: string;
  readonly advisorId: string;
  readonly noteType: SharedNoteType;
  readonly content: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: number;
}

/**
 * Creates a frozen SharedNote instance.
 */
export function createSharedNote(note: SharedNote): SharedNote {
  return Object.freeze({
    ...note,
    metadata: Object.freeze({ ...note.metadata }),
  });
}

import type { AdvisorId } from '../AdvisorIdentity.js';

/**
 * Resolution status of a debate.
 */
export enum DebateResolution {
  UNRESOLVED = 'unresolved',
  ADVISOR_A = 'advisor_a',
  ADVISOR_B = 'advisor_b',
  COMPROMISE = 'compromise',
  ESCALATED = 'escalated',
}

/**
 * Immutable debate record between two advisors.
 */
export interface AdvisorDebate {
  readonly debateId: string;
  readonly advisorA: AdvisorId;
  readonly advisorB: AdvisorId;
  readonly topic: string;
  readonly positionA: string;
  readonly positionB: string;
  readonly resolved: boolean;
  readonly resolution?: DebateResolution;
  readonly winner?: AdvisorId;
  readonly createdAt: number;
  readonly resolvedAt?: number;
}

/**
 * Creates a frozen AdvisorDebate instance.
 */
export function createAdvisorDebate(debate: AdvisorDebate): AdvisorDebate {
  return Object.freeze({
    ...debate,
    advisorA: debate.advisorA,
    advisorB: debate.advisorB,
  });
}

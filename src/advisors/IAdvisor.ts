import type { AdvisorId, AdvisorProfile } from './AdvisorIdentity.js';

/**
 * Contract for an Advisor persona.
 *
 * This is a pure data contract — no routing, no workflow execution,
 * no AI calls, and no speculative logic.
 */
export interface IAdvisor {
  /** Unique advisor identifier. */
  readonly id: AdvisorId;

  /** Immutable advisor profile. */
  readonly profile: AdvisorProfile;
}
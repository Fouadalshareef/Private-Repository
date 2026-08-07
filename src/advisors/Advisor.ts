import type { AdvisorId, AdvisorProfile } from './AdvisorIdentity.js';
import type { IAdvisor } from './IAdvisor.js';

/**
 * Immutable default implementation of the IAdvisor contract.
 *
 * All reference fields are defensive-copied and frozen at construction time.
 */
export class Advisor implements IAdvisor {
  public readonly id: AdvisorId;
  public readonly profile: AdvisorProfile;

  constructor(id: AdvisorId, profile: AdvisorProfile) {
    this.id = id;
    this.profile = Object.freeze({
      name: profile.name,
      description: profile.description,
      specialty: profile.specialty,
      responsibilities: Object.freeze([...profile.responsibilities]),
      systemPrompt: profile.systemPrompt,
      capabilities: Object.freeze([...profile.capabilities]),
      allowedTools: Object.freeze([...profile.allowedTools]),
      metadata: Object.freeze({ ...profile.metadata }),
      ...(profile.routingKeywords ? { routingKeywords: Object.freeze([...profile.routingKeywords]) } : {}),
    });
    Object.freeze(this);
  }
}
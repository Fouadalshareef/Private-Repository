import type { AdvisorId, AdvisorProfile } from './AdvisorIdentity.js';
import { createAdvisorId, createAdvisorCapability } from './AdvisorIdentity.js';
import type { IAdvisor } from './IAdvisor.js';
import { Advisor } from './Advisor.js';

/**
 * Input definition for creating an advisor via AdvisorFactory.
 */
export interface AdvisorDefinition {
  readonly id: AdvisorId | string;
  readonly profile: AdvisorProfile;
}

/**
 * Factory for safely creating immutable advisors with validation,
 * defensive copies, and freezing.
 */
export class AdvisorFactory {
  /**
   * Creates an immutable IAdvisor from the given definition.
   * @param definition The advisor definition.
   * @returns A frozen, immutable advisor.
   * @throws {Error} When the definition is invalid.
   */
  public create(definition: AdvisorDefinition): IAdvisor {
    if (!definition.id || String(definition.id).trim().length === 0) {
      throw new Error('Advisor id is required and must be a non-empty string.');
    }
    if (!definition.profile || !definition.profile.name || definition.profile.name.trim().length === 0) {
      throw new Error('Advisor profile name is required.');
    }
    if (!definition.profile.systemPrompt || definition.profile.systemPrompt.trim().length === 0) {
      throw new Error('Advisor systemPrompt is required.');
    }

    const id = createAdvisorId(String(definition.id));
    const profile = definition.profile;

    const frozenProfile: AdvisorProfile = Object.freeze({
      name: profile.name.trim(),
      description: profile.description?.trim() ?? '',
      specialty: profile.specialty?.trim() ?? '',
      responsibilities: Object.freeze([...(profile.responsibilities ?? [])]),
      systemPrompt: profile.systemPrompt.trim(),
      capabilities: Object.freeze([
        ...(profile.capabilities ?? []).map((c) => createAdvisorCapability(String(c).trim())),
      ]),
      allowedTools: Object.freeze([...(profile.allowedTools ?? [])]),
      metadata: Object.freeze({ ...(profile.metadata ?? {}) }),
    });

    return new Advisor(id, frozenProfile);
  }
}
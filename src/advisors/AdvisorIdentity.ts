/**
 * Strongly-typed advisor identifier.
 */
export type AdvisorId = string & { readonly __brand: 'AdvisorId' };

/**
 * Strongly-typed advisor capability identifier.
 */
export type AdvisorCapability = string & { readonly __brand: 'AdvisorCapability' };

/**
 * Immutable advisor profile information.
 */
export interface AdvisorProfile {
  readonly name: string;
  readonly description: string;
  readonly specialty: string;
  readonly responsibilities: readonly string[];
  readonly systemPrompt: string;
  readonly capabilities: readonly AdvisorCapability[];
  readonly allowedTools: readonly string[];
  readonly metadata: Readonly<Record<string, string>>;
  readonly routingKeywords?: readonly string[];
}

/**
 * Creates an AdvisorId from a string value.
 */
export function createAdvisorId(value: string): AdvisorId {
  return value as AdvisorId;
}

/**
 * Creates an AdvisorCapability from a string value.
 */
export function createAdvisorCapability(value: string): AdvisorCapability {
  return value as AdvisorCapability;
}

/**
 * Creates a frozen, defensive copy of an AdvisorProfile.
 */
export function createAdvisorProfile(profile: AdvisorProfile): AdvisorProfile {
  return Object.freeze({
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
}
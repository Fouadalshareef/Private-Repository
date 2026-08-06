import type { AgentCapability } from './AgentCapability.js';

/**
 * Provides capability matching operations against a set of capabilities.
 */
export class AgentCapabilityMatcher {
  private readonly capabilities: ReadonlySet<string>;

  constructor(capabilities: readonly AgentCapability[]) {
    this.capabilities = new Set<string>(capabilities.map((c) => String(c)));
    Object.freeze(this);
  }

  /**
   * Determines whether this set supports the given capability.
   */
  supports(capability: AgentCapability): boolean {
    return this.capabilities.has(String(capability));
  }

  /**
   * Determines whether this set supports all the given capabilities.
   */
  supportsAll(capabilities: readonly AgentCapability[]): boolean {
    return capabilities.every((c) => this.supports(c));
  }

  /**
   * Determines whether this set supports at least one of the given capabilities.
   */
  supportsAny(capabilities: readonly AgentCapability[]): boolean {
    return capabilities.some((c) => this.supports(c));
  }

  /**
   * Returns a frozen snapshot of the capabilities.
   */
  snapshot(): readonly AgentCapability[] {
    return Object.freeze(Array.from(this.capabilities) as AgentCapability[]);
  }
}
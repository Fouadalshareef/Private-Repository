import type { AdvisorId } from './AdvisorIdentity.js';
import type { IAdvisor } from './IAdvisor.js';

/**
 * How the routing decision was made.
 */
export type RoutingMatchType = 'direct' | 'keyword' | 'metadata' | 'rule' | 'fallback';

/**
 * Options for routing an input/context to an advisor.
 */
export interface RoutingOptions {
  /** The user input or context text to route. */
  readonly input: string;

  /** Direct routing: explicitly request a specific advisor by id. */
  readonly preferredAdvisorId?: AdvisorId;

  /** Optional metadata key/value pairs used for metadata-based matching. */
  readonly metadata?: Readonly<Record<string, string>>;

  /** Custom fallback advisor id. Defaults to Chief AI Architect. */
  readonly fallbackAdvisorId?: AdvisorId;
}

/**
 * Immutable result of a routing decision.
 */
export interface RoutingResult {
  /** The selected advisor. */
  readonly advisor: IAdvisor;

  /** How the match was determined. */
  readonly matchedBy: RoutingMatchType;

  /** Confidence score between 0 and 1. */
  readonly confidence: number;

  /** Keywords that contributed to the match (empty for direct/fallback). */
  readonly matchedKeywords: readonly string[];

  /** Timestamp of the routing decision. */
  readonly timestamp: number;
}

/**
 * A deterministic routing rule mapping keywords/metadata to an advisor.
 */
export interface RoutingRule {
  /** Unique rule identifier. */
  readonly id: string;

  /** The advisor id this rule routes to. */
  readonly advisorId: AdvisorId;

  /** Keywords that trigger this rule. */
  readonly keywords: readonly string[];

  /** Optional metadata key/value pairs that must match. */
  readonly metadata?: Readonly<Record<string, string>>;

  /** Rule priority (higher wins). Defaults to 0. */
  readonly priority?: number;
}

/**
 * Contract for the Context Router.
 *
 * Routes user inputs/contexts to the most suitable Advisor Persona
 * based on capabilities, specialties, or predefined routing rules.
 * The routing decision logic is deterministic, rule-based, pure
 * TypeScript — no external AI service calls.
 */
export interface IContextRouter {
  /**
   * Routes the given input/context to the most suitable advisor.
   * @param options The routing options.
   * @returns An immutable routing result.
   */
  route(options: RoutingOptions): RoutingResult;

  /**
   * Adds a custom routing rule.
   * @param rule The rule to add.
   */
  addRule(rule: RoutingRule): void;

  /**
   * Removes a routing rule by id.
   * @param ruleId The id of the rule to remove.
   * @returns True if a rule was removed.
   */
  removeRule(ruleId: string): boolean;

  /**
   * Lists all custom routing rules as an immutable snapshot.
   */
  listRules(): readonly RoutingRule[];
}
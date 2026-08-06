import type { IAdvisor } from './IAdvisor.js';
import type { ITool } from '../tools/ITool.js';
import type { IToolRegistry } from '../tools/IToolRegistry.js';

/**
 * Result of a single tool access check.
 */
export interface ToolAccessDecision {
  readonly allowed: boolean;
  readonly toolName: string;
  readonly advisorId: string;
  readonly reason: string;
  readonly matchedRule: string | undefined;
}

/**
 * Result of resolving all allowed tools for an advisor.
 */
export interface AdvisorToolScope {
  readonly advisorId: string;
  readonly allowedTools: readonly ITool[];
  readonly deniedTools: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Contract for advisor tool access control.
 *
 * Evaluates an advisor's `allowedTools` against the registered tool registry,
 * supports wildcard matching, and returns immutable access decisions.
 */
export interface IAdvisorSecurityPolicy {
  /**
   * Resolves the list of tools an advisor is allowed to use from the registry.
   * @param advisor The advisor to evaluate.
   * @param registry The tool registry.
   * @param providedTools Optional pre-filtered tools. If omitted, uses registry.getAllTools().
   * @returns An immutable AdvisorToolScope.
   */
  resolveAllowedTools(
    advisor: IAdvisor,
    registry: IToolRegistry,
    providedTools?: readonly ITool[],
  ): AdvisorToolScope;

  /**
   * Checks whether an advisor is allowed to use a specific tool.
   * @param advisor The advisor to check.
   * @param toolName The tool name to check.
   * @returns An immutable ToolAccessDecision.
   */
  checkAccess(advisor: IAdvisor, toolName: string): ToolAccessDecision;

  /**
   * Returns tool names that are registered but not allowed for the advisor.
   * @param advisor The advisor to evaluate.
   * @param registry The tool registry.
   * @returns A frozen array of denied tool names.
   */
  getDeniedTools(advisor: IAdvisor, registry: IToolRegistry): readonly string[];
}

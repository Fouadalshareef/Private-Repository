import type { IAdvisor } from './IAdvisor.js';
import type { ITool } from '../tools/ITool.js';
import type { IToolRegistry } from '../tools/IToolRegistry.js';
import type { IAdvisorSecurityPolicy, ToolAccessDecision, AdvisorToolScope } from './IAdvisorSecurityPolicy.js';

/**
 * Default maximum number of warnings to collect.
 */
const MAX_WARNINGS = 10;

/**
 * Advisor Security Policy Engine.
 *
 * Evaluates an advisor's `allowedTools` array against the registered tool registry.
 * Supports wildcard patterns using `*` (match any sequence) and `?` (match single character).
 * All returned decisions and scopes are deeply frozen with Object.freeze.
 */
export class AdvisorSecurityPolicy implements IAdvisorSecurityPolicy {
  /**
   * Resolves the list of tools an advisor is allowed to use from the registry.
   */
  public resolveAllowedTools(
    advisor: IAdvisor,
    registry: IToolRegistry,
    providedTools?: readonly ITool[],
  ): AdvisorToolScope {
    const availableTools = providedTools ?? registry.getAllTools();
    const allowedPatterns = advisor.profile.allowedTools ?? [];
    const deniedTools: string[] = [];
    const warnings: string[] = [];
    const allowed: ITool[] = [];

    for (const tool of availableTools) {
      const matchResult = this.matchTool(tool.name, allowedPatterns);
      if (matchResult.matched) {
        allowed.push(tool);
      } else {
        deniedTools.push(tool.name);
      }
    }

    // Warn about patterns that did not match any registered tool
    const unmatchedPatterns = allowedPatterns.filter((pattern) => {
      return !availableTools.some((tool) => this.matchTool(tool.name, [pattern]).matched);
    });

    for (const pattern of unmatchedPatterns.slice(0, MAX_WARNINGS)) {
      warnings.push(`Allowed tool pattern "${pattern}" did not match any registered tool.`);
    }

    return Object.freeze({
      advisorId: String(advisor.id),
      allowedTools: Object.freeze([...allowed]),
      deniedTools: Object.freeze([...deniedTools]),
      warnings: Object.freeze([...warnings]),
    });
  }

  /**
   * Checks whether an advisor is allowed to use a specific tool.
   */
  public checkAccess(advisor: IAdvisor, toolName: string): ToolAccessDecision {
    const allowedPatterns = advisor.profile.allowedTools ?? [];
    const matchResult = this.matchTool(toolName, allowedPatterns);

    let reason: string;
    let matchedRule: string | undefined;

    if (matchResult.matched) {
      matchedRule = matchResult.pattern;
      reason = `Tool "${toolName}" is allowed for advisor "${advisor.profile.name}" via pattern "${matchResult.pattern}".`;
    } else {
      reason = `Tool "${toolName}" is not in the allowed tools list for advisor "${advisor.profile.name}". ` +
        `Allowed tools: ${allowedPatterns.join(', ') || '(none)'}.`;
    }

    return Object.freeze({
      allowed: matchResult.matched,
      toolName,
      advisorId: String(advisor.id),
      reason,
      matchedRule,
    });
  }

  /**
   * Returns tool names that are registered but not allowed for the advisor.
   */
  public getDeniedTools(advisor: IAdvisor, registry: IToolRegistry): readonly string[] {
    const scope = this.resolveAllowedTools(advisor, registry);
    return scope.deniedTools;
  }

  /**
   * Matches a tool name against an array of allowed patterns.
   * Supports wildcard patterns: `*` matches any sequence, `?` matches single character.
   * Also matches against the short tool name (basename after the last `.`).
   */
  private matchTool(toolName: string, patterns: readonly string[]): { matched: boolean; pattern: string } {
    const shortName = toolName.includes('.') ? toolName.split('.').pop()! : toolName;
    for (const pattern of patterns) {
      if (this.wildcardMatch(toolName, pattern) || this.wildcardMatch(shortName, pattern)) {
        return { matched: true, pattern };
      }
    }
    return { matched: false, pattern: '' };
  }

  /**
   * Wildcard matching supporting `*` and `?`.
   * - `*` matches zero or more characters
   * - `?` matches exactly one character
   */
  private wildcardMatch(value: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(value);
  }
}

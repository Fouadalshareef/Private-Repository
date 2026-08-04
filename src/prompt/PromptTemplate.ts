import type { IPromptTemplate, PromptRenderOptions, PromptRenderResult } from './IPromptTemplate.js';
import { MissingPromptVariableError } from './PromptError.js';

/**
 * Implementation of prompt template rendering with variable substitution.
 */
export class PromptTemplate implements IPromptTemplate {
  public readonly id: string;
  public readonly template: string;
  public readonly description?: string;
  public readonly metadata?: Readonly<Record<string, unknown>>;

  constructor(id: string, template: string, description?: string, metadata?: Record<string, unknown>) {
    this.id = id;
    this.template = template;
    this.description = description;
    this.metadata = metadata;
  }

  /**
   * Renders the template with the given variables.
   */
  render(options: PromptRenderOptions): PromptRenderResult {
    const { variables, strict = true } = options;
    const missingVariables: string[] = [];
    const usedVariables: Record<string, unknown> = {};

    // Extract all variable names from template
    const variableNames = this.extractVariableNames(this.template);

    // Check for missing variables in strict mode
    if (strict) {
      for (const varName of variableNames) {
        if (!(varName in variables)) {
          throw new MissingPromptVariableError(varName);
        }
      }
    }

    // Replace variables in template
    let rendered = this.template;
    for (const varName of variableNames) {
      const placeholder = `{{${varName}}}`;
      if (varName in variables) {
        const value = String(variables[varName]);
        rendered = rendered.replaceAll(placeholder, value);
        usedVariables[varName] = variables[varName];
      } else if (strict) {
        // This should not happen due to check above, but safety first
        throw new MissingPromptVariableError(varName);
      } else {
        // Keep placeholder in non-strict mode
        missingVariables.push(varName);
      }
    }

    return {
      content: rendered,
      usedVariables,
      missingVariables,
    };
  }

  /**
   * Extracts variable names from a template string.
   */
  extractVariableNames(template: string): readonly string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(template)) !== null) {
      const varName = match[1];
      if (!variables.includes(varName)) {
        variables.push(varName);
      }
    }

    return variables;
  }
}
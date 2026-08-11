import type { IFileSystem } from '../filesystem/IFileSystem.js';
import type { LanguageType } from '../language/LanguageType.js';
import type { ValidationResult, ValidationOptions } from './ValidationTypes.js';

/**
 * Contract for the Validation Engine.
 *
 * Validates code changes without modifying source files. The engine
 * supports TypeScript type-checking, test execution, and basic syntax
 * validation. It never auto-repairs code; it only reports.
 */
export interface IValidationEngine {
  /**
   * Validates a project using the specified validation types.
   *
   * @param options The validation options.
   * @param fileSystem The file system to read files from.
   * @returns The validation result.
   */
  validate(options: ValidationOptions, fileSystem: IFileSystem): Promise<ValidationResult>;

  /**
   * Validates TypeScript files in a project.
   *
   * @param projectPath The project root path.
   * @param fileSystem The file system to read files from.
   * @returns The validation result.
   */
  validateTypeScript(projectPath: string, fileSystem: IFileSystem): Promise<ValidationResult>;

  /**
   * Validates the syntax of a single file.
   *
   * @param content The file content.
   * @param language The language type.
   * @param filePath The file path.
   * @returns The validation result.
   */
  validateSyntax(content: string, language: LanguageType, filePath: string): ValidationResult;

  /**
   * Validates a patch by applying it to base content and then running
   * syntax validation on the result.
   *
   * @param baseContent The original content.
   * @param newContent The patched content.
   * @param language The language type.
   * @param filePath The file path.
   * @returns The validation result.
   */
  validatePatchContent(baseContent: string, newContent: string, language: LanguageType, filePath: string): ValidationResult;
}

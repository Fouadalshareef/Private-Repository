import type { IValidationEngine } from './IValidationEngine.js';
import type { ValidationResult, ValidationOptions, ValidationMessage } from './ValidationTypes.js';
import { ValidationType, ValidationSeverity } from './ValidationTypes.js';
import type { IFileSystem } from '../filesystem/IFileSystem.js';
import { LanguageType } from '../language/LanguageType.js';
import { SourceParser } from '../language/SourceParser.js';
import { spawn } from 'child_process';

/**
 * Validation Engine implementation.
 *
 * Validates code changes without modifying source files. Supports
 * TypeScript type-checking, test execution, and basic syntax validation.
 * Never auto-repairs code; it only reports.
 */
export class ValidationEngine implements IValidationEngine {
  private readonly parser: SourceParser;

  constructor(parser?: SourceParser) {
    this.parser = parser ?? new SourceParser();
  }

  public async validate(options: ValidationOptions, fileSystem: IFileSystem): Promise<ValidationResult> {
    const startTime = Date.now();
    const messages: ValidationMessage[] = [];
    let valid = true;

    for (const type of options.types) {
      try {
        switch (type) {
          case ValidationType.TYPESCRIPT: {
            const tsResult = await this.validateTypeScript(options.projectPath, fileSystem);
            messages.push(...tsResult.messages);
            if (!tsResult.valid) {
              valid = false;
            }
            break;
          }
          case ValidationType.TESTS: {
            const testResult = await this.validateTests(options.projectPath);
            messages.push(...testResult.messages);
            if (!testResult.valid) {
              valid = false;
            }
            break;
          }
          case ValidationType.SYNTAX: {
            const syntaxResult = await this.validateSyntaxFiles(options.projectPath, fileSystem);
            messages.push(...syntaxResult.messages);
            if (!syntaxResult.valid) {
              valid = false;
            }
            break;
          }
        }
      } catch (error) {
        if (!options.continueOnError) {
          return {
            valid: false,
            messages: Object.freeze([
              ...messages,
              {
                severity: ValidationSeverity.ERROR,
                message: `Validation failed for ${type}: ${error instanceof Error ? error.message : String(error)}`,
              },
            ]),
            durationMs: Date.now() - startTime,
          };
        }
      }
    }

    return {
      valid,
      messages: Object.freeze(messages),
      durationMs: Date.now() - startTime,
    };
  }

  public async validateTypeScript(projectPath: string, fileSystem: IFileSystem): Promise<ValidationResult> {
    const startTime = Date.now();
    const messages: ValidationMessage[] = [];

    try {
      const tsconfigPath = `${projectPath}/tsconfig.json`;
      if (!fileSystem.exists(tsconfigPath)) {
        return {
          valid: true,
          messages: Object.freeze(messages),
          durationMs: Date.now() - startTime,
        };
      }

      const result = await this.runCommand('npx', ['tsc', '--noEmit', '--pretty', 'false'], projectPath);
      
      if (result.code !== 0) {
        messages.push({
          severity: ValidationSeverity.ERROR,
          message: 'TypeScript type-check failed',
        });
      }

      return {
        valid: result.code === 0,
        messages: Object.freeze(messages),
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        valid: false,
        messages: Object.freeze([
          ...messages,
          {
            severity: ValidationSeverity.ERROR,
            message: `TypeScript validation failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ]),
        durationMs: Date.now() - startTime,
      };
    }
  }

  public validateSyntax(content: string, language: LanguageType, filePath: string): ValidationResult {
    const startTime = Date.now();
    const messages: ValidationMessage[] = [];

    try {
      if (language === LanguageType.JSON) {
        JSON.parse(content);
      } else {
        this.parser.parseSymbols(content, language, filePath, '');
      }

      return {
        valid: true,
        messages: Object.freeze(messages),
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        valid: false,
        messages: Object.freeze([
          {
            severity: ValidationSeverity.ERROR,
            file: filePath,
            message: error instanceof Error ? error.message : String(error),
          },
        ]),
        durationMs: Date.now() - startTime,
      };
    }
  }

  public validatePatchContent(baseContent: string, newContent: string, language: LanguageType, filePath: string): ValidationResult {
    const startTime = Date.now();

    const syntaxResult = this.validateSyntax(newContent, language, filePath);
    if (!syntaxResult.valid) {
      return syntaxResult;
    }

    return {
      valid: true,
      messages: Object.freeze([]),
      durationMs: Date.now() - startTime,
    };
  }

  private async validateSyntaxFiles(projectPath: string, fileSystem: IFileSystem): Promise<ValidationResult> {
    const startTime = Date.now();
    const messages: ValidationMessage[] = [];
    let valid = true;

    // For MVP, validate a sample of source files or all files if small
    // This is a simplified implementation
    const files = await this.listSourceFiles(projectPath, fileSystem);
    for (const file of files.slice(0, 50)) {
      try {
        const content = fileSystem.readFile(file);
        const language = this.detectLanguage(file);
        const result = this.validateSyntax(content, language, file);
        messages.push(...result.messages);
        if (!result.valid) {
          valid = false;
        }
      } catch {
        // skip unreadable files
      }
    }

    return {
      valid,
      messages: Object.freeze(messages),
      durationMs: Date.now() - startTime,
    };
  }

  private async validateTests(projectPath: string): Promise<ValidationResult> {
    const startTime = Date.now();
    const messages: ValidationMessage[] = [];

    try {
      const result = await this.runCommand('npm', ['test', '--', '--run'], projectPath);
      
      if (result.code !== 0) {
        messages.push({
          severity: ValidationSeverity.ERROR,
          message: 'Test suite failed',
        });
      }

      return {
        valid: result.code === 0,
        messages: Object.freeze(messages),
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        valid: false,
        messages: Object.freeze([
          {
            severity: ValidationSeverity.ERROR,
            message: `Test validation failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ]),
        durationMs: Date.now() - startTime,
      };
    }
  }

  private async runCommand(command: string, args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const proc = spawn(command, args, { cwd, shell: true });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          code: code ?? 1,
          stdout,
          stderr,
        });
      });
    });
  }

  private detectLanguage(path: string): LanguageType {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    switch (ext) {
      case 'ts':
      case 'tsx':
        return LanguageType.TYPESCRIPT;
      case 'js':
      case 'jsx':
      case 'mjs':
      case 'cjs':
        return LanguageType.JAVASCRIPT;
      case 'py':
        return LanguageType.PYTHON;
      case 'json':
        return LanguageType.JSON;
      default:
        return LanguageType.UNKNOWN;
    }
  }

  private async listSourceFiles(projectPath: string, fileSystem: IFileSystem): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.json'];
    
    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = fileSystem.list(dir);
        for (const entry of entries) {
          if (entry.isDirectory) {
            const name = entry.path.split('/').pop() ?? '';
            if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) {
              continue;
            }
            await walk(entry.path);
          } else {
            const ext = entry.path.split('.').pop()?.toLowerCase() ?? '';
            if (extensions.includes(`.${ext}`)) {
              files.push(entry.path);
            }
          }
        }
      } catch {
        // skip inaccessible directories
      }
    };

    await walk(projectPath);
    return files;
  }
}

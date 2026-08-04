import type { SourceSymbol } from '../source/SourceSymbol.js';
import { LanguageType } from './LanguageType.js';
import { ParseError } from './LanguageError.js';

/**
 * A generic regex/pattern-based fallback parser for extracting symbols
 * from source code content.
 *
 * This parser does NOT use heavyweight compiler tools (TypeScript compiler,
 * Babel, Tree-sitter). It uses structural regex patterns to extract
 * classes, interfaces, functions, variables, imports, and exports.
 */
export class SourceParser {
  /**
   * Parses symbols from the given content for the specified language.
   *
   * @param content The source code content.
   * @param language The language type.
   * @param filePath The file path (used for symbol metadata).
   * @returns An array of extracted symbols.
   * @throws {ParseError} If parsing fails.
   */
  public parseSymbols(
    content: string,
    language: LanguageType,
    filePath: string,
  ): SourceSymbol[] {
    switch (language) {
      case LanguageType.TYPESCRIPT:
      case LanguageType.JAVASCRIPT:
        return this.parseTypeScriptJavaScript(content, filePath);
      case LanguageType.PYTHON:
        return this.parsePython(content, filePath);
      case LanguageType.JSON:
        return this.parseJson(content, filePath);
      case LanguageType.HTML:
      case LanguageType.CSS:
        return [];
      default:
        return [];
    }
  }

  /**
   * Extracts import statements from the given content.
   *
   * @param content The source code content.
   * @param language The language type.
   * @returns An array of import paths.
   */
  public extractImports(content: string, language: LanguageType): string[] {
    switch (language) {
      case LanguageType.TYPESCRIPT:
      case LanguageType.JAVASCRIPT:
        return this.extractTypeScriptJavaScriptImports(content);
      case LanguageType.PYTHON:
        return this.extractPythonImports(content);
      default:
        return [];
    }
  }

  /**
   * Parses TypeScript/JavaScript content for symbols.
   */
  private parseTypeScriptJavaScript(content: string, filePath: string): SourceSymbol[] {
    const symbols: SourceSymbol[] = [];

    // Classes: class Name
    const classRegex = /\b(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
    this.collectMatches(content, classRegex, 'class', filePath, symbols);

    // Interfaces: interface Name
    const interfaceRegex = /\b(?:export\s+)?interface\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
    this.collectMatches(content, interfaceRegex, 'interface', filePath, symbols);

    // Functions: function name(
    const functionRegex = /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
    this.collectMatches(content, functionRegex, 'function', filePath, symbols);

    // Arrow functions and const functions: const name = ( or const name = function
    const arrowRegex = /\b(?:export\s+)?const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\(/g;
    this.collectMatches(content, arrowRegex, 'function', filePath, symbols);

    // Type aliases: type Name =
    const typeRegex = /\b(?:export\s+)?type\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[=<]/g;
    this.collectMatches(content, typeRegex, 'type', filePath, symbols);

    // Enum: enum Name
    const enumRegex = /\b(?:export\s+)?(?:const\s+)?enum\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
    this.collectMatches(content, enumRegex, 'enum', filePath, symbols);

    return symbols;
  }

  /**
   * Parses Python content for symbols.
   */
  private parsePython(content: string, filePath: string): SourceSymbol[] {
    const symbols: SourceSymbol[] = [];

    // Classes: class Name (allow leading whitespace)
    const classRegex = /^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
    this.collectMatches(content, classRegex, 'class', filePath, symbols);

    // Functions: def name(
    const functionRegex = /^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
    this.collectMatches(content, functionRegex, 'function', filePath, symbols);

    // Async functions: async def name(
    const asyncFunctionRegex = /^\s*async\s+def\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
    this.collectMatches(content, asyncFunctionRegex, 'function', filePath, symbols);

    return symbols;
  }

  /**
   * Parses JSON content for symbols (top-level keys).
   */
  private parseJson(content: string, filePath: string): SourceSymbol[] {
    const symbols: SourceSymbol[] = [];
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (typeof parsed === 'object' && parsed !== null) {
        for (const key of Object.keys(parsed)) {
          symbols.push({
            name: key,
            kind: 'property',
            filePath,
            line: 0,
          });
        }
      }
    } catch {
      throw new ParseError(`Failed to parse JSON content in file: "${filePath}"`);
    }
    return symbols;
  }

  /**
   * Extracts import paths from TypeScript/JavaScript content.
   */
  private extractTypeScriptJavaScriptImports(content: string): string[] {
    const imports: string[] = [];
    // Match: import ... from '...', import('...'), require('...')
    const importRegex = /(?:import\s+.*?\s+from\s+|import\s*\(\s*|require\s*\(\s*)['"`]([^'"`]+)['"`]/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  }

  /**
   * Extracts import paths from Python content.
   */
  private extractPythonImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /^\s*(?:import\s+|from\s+)([A-Za-z_][A-Za-z0-9_.]*)/gm;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  }

  /**
   * Collects regex matches and pushes them as symbols.
   */
  private collectMatches(
    content: string,
    regex: RegExp,
    kind: string,
    filePath: string,
    symbols: SourceSymbol[],
  ): void {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const name = match[1];
      if (name) {
        const line = this.getLineNumber(content, match.index);
        symbols.push({
          name,
          kind,
          filePath,
          line,
        });
      }
    }
  }

  /**
   * Returns the 1-based line number for a character index.
   */
  private getLineNumber(content: string, index: number): number {
    if (index < 0) {
      return 0;
    }
    let line = 1;
    for (let i = 0; i < index && i < content.length; i++) {
      if (content[i] === '\n') {
        line++;
      }
    }
    return line;
  }
}
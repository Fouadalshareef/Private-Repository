import type { SourceSymbol } from '../source/SourceSymbol.js';
import { LanguageType } from './LanguageType.js';
import { ParseError } from './LanguageError.js';

/**
 * A generic regex/pattern-based fallback parser for extracting symbols
 * from source code content.
 *
 * This parser does NOT use heavyweight compiler tools (TypeScript compiler,
 * Babel, Tree-sitter). It uses structural regex patterns to extract
 * classes, interfaces, functions, methods, types, enums, variables,
 * imports, and exports.
 */
export class SourceParser {
  /**
   * Parses symbols from the given content for the specified language.
   *
   * @param content The source code content.
   * @param language The language type.
   * @param filePath The file path (used for symbol metadata).
   * @param projectId The project identifier (used for symbol identity).
   * @returns An array of extracted symbols.
   * @throws {ParseError} If parsing fails.
   */
  public parseSymbols(
    content: string,
    language: LanguageType,
    filePath: string,
    projectId: string,
  ): SourceSymbol[] {
    switch (language) {
      case LanguageType.TYPESCRIPT:
      case LanguageType.JAVASCRIPT:
        return this.parseTypeScriptJavaScript(content, filePath, projectId);
      case LanguageType.PYTHON:
        return this.parsePython(content, filePath, projectId);
      case LanguageType.JSON:
        return this.parseJson(content, filePath, projectId);
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
   * Extracts export specifiers from the given content.
   *
   * @param content The source code content.
   * @param language The language type.
   * @returns An array of exported symbol names.
   */
  public extractExports(content: string, language: LanguageType): string[] {
    switch (language) {
      case LanguageType.TYPESCRIPT:
      case LanguageType.JAVASCRIPT:
        return this.extractTypeScriptJavaScriptExports(content);
      case LanguageType.PYTHON:
        return this.extractPythonExports(content);
      default:
        return [];
    }
  }

  /**
   * Parses TypeScript/JavaScript content for symbols.
   */
  private parseTypeScriptJavaScript(content: string, filePath: string, projectId: string): SourceSymbol[] {
    const symbols: SourceSymbol[] = [];

    // Classes: class Name
    const classRegex = /\b(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
    this.collectMatches(content, classRegex, 'class', filePath, projectId, symbols);

    // Interfaces: interface Name
    const interfaceRegex = /\b(?:export\s+)?interface\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
    this.collectMatches(content, interfaceRegex, 'interface', filePath, projectId, symbols);

    // Functions: function name(
    const functionRegex = /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
    this.collectMatches(content, functionRegex, 'function', filePath, projectId, symbols);

    // Arrow functions and const functions: const name = ( or const name = function
    const arrowRegex = /\b(?:export\s+)?const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\(/g;
    this.collectMatches(content, arrowRegex, 'function', filePath, projectId, symbols);

    // Type aliases: type Name =
    const typeRegex = /\b(?:export\s+)?type\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[=<]/g;
    this.collectMatches(content, typeRegex, 'type', filePath, projectId, symbols);

    // Enum: enum Name
    const enumRegex = /\b(?:export\s+)?(?:const\s+)?enum\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
    this.collectMatches(content, enumRegex, 'enum', filePath, projectId, symbols);

    // Variables/constants: const/let/var name = ...
    const variableRegex = /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/g;
    this.collectMatches(content, variableRegex, 'variable', filePath, projectId, symbols);

    // Methods inside classes: methodName( or async methodName(
    const methodRegex = /(?:public|private|protected|readonly)?\s*(?:async\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    // We only collect methods that are indented (inside a class)
    const lines = content.split('\n');
    let inClass = false;
    let classIndent = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('class ')) {
        inClass = true;
        classIndent = line.search(/\S|$/);
      } else if (inClass && line.trim().length === 0) {
        // empty line inside class, still in class
      } else if (inClass && line.search(/\S|$/) <= classIndent && !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*')) {
        inClass = false;
      }
      if (inClass) {
        const match = methodRegex.exec(line);
        if (match) {
          const name = match[1];
          if (name && !['if', 'while', 'for', 'switch', 'catch', 'with'].includes(name)) {
            const parentClassMatch = content.slice(0, content.indexOf(line)).match(/class\s+([A-Za-z_$][A-Za-z0-9_$]*)/g);
            const parentName = parentClassMatch ? parentClassMatch[parentClassMatch.length - 1].replace('class ', '').trim() : undefined;
            const qualifiedName = parentName ? `${parentName}.${name}` : name;
            const id = this.buildSymbolId(projectId, filePath, name, 'method', i + 1);
            symbols.push({
              id,
              projectId,
              name,
              kind: 'method',
              filePath,
              line: i + 1,
              parentName,
              qualifiedName,
            });
          }
        }
      }
    }

    return symbols;
  }

  /**
   * Parses Python content for symbols.
   */
  private parsePython(content: string, filePath: string, projectId: string): SourceSymbol[] {
    const symbols: SourceSymbol[] = [];

    // Classes: class Name (allow leading whitespace)
    const classRegex = /^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
    this.collectMatches(content, classRegex, 'class', filePath, projectId, symbols);

    // Functions: def name(
    const functionRegex = /^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
    this.collectMatches(content, functionRegex, 'function', filePath, projectId, symbols);

    // Async functions: async def name(
    const asyncFunctionRegex = /^\s*async\s+def\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
    this.collectMatches(content, asyncFunctionRegex, 'function', filePath, projectId, symbols);

    // Variables/constants at module level
    const variableRegex = /^[A-Za-z_][A-Za-z0-9_]*\s*=/gm;
    this.collectMatches(content, variableRegex, 'variable', filePath, projectId, symbols);

    return symbols;
  }

  /**
   * Parses JSON content for symbols (top-level keys).
   */
  private parseJson(content: string, filePath: string, projectId: string): SourceSymbol[] {
    const symbols: SourceSymbol[] = [];
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (typeof parsed === 'object' && parsed !== null) {
        for (const key of Object.keys(parsed)) {
          symbols.push({
            id: this.buildSymbolId(projectId, filePath, key, 'property', 0),
            projectId,
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
    const importRegex = /(?:import\s+.*?\s+from\s+|import\s*\(\s*|require\s*\(\s*)['"`]([^'"`]+)['"`]/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  }

  /**
   * Extracts export specifiers from TypeScript/JavaScript content.
   */
  private extractTypeScriptJavaScriptExports(content: string): string[] {
    const exports: string[] = [];
    const exportRegex = /\bexport\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
    let match: RegExpExecArray | null;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    return exports;
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
   * Extracts exported names from Python content.
   */
  private extractPythonExports(content: string): string[] {
    const exports: string[] = [];
    const exportRegex = /^__all__\s*=\s*\[([^\]]+)\]/gm;
    let match: RegExpExecArray | null;
    while ((match = exportRegex.exec(content)) !== null) {
      const names = match[1].split(',').map((n) => n.trim().replace(/['"]/g, ''));
      exports.push(...names.filter(Boolean));
    }
    return exports;
  }

  /**
   * Collects regex matches and pushes them as symbols.
   */
  private collectMatches(
    content: string,
    regex: RegExp,
    kind: string,
    filePath: string,
    projectId: string,
    symbols: SourceSymbol[],
  ): void {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const name = match[1];
      if (name) {
        const line = this.getLineNumber(content, match.index);
        const id = this.buildSymbolId(projectId, filePath, name, kind, line);
        symbols.push({
          id,
          projectId,
          name,
          kind,
          filePath,
          line,
        });
      }
    }
  }

  /**
   * Builds a deterministic symbol identity.
   */
  public buildSymbolId(projectId: string, filePath: string, name: string, kind: string, line: number): string {
    return `${projectId}:symbol:${filePath}:${name}:${kind}:${line}`;
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

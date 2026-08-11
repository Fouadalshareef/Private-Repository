import type { LanguageType } from './LanguageType.js';
import type { SourceSymbol } from '../source/SourceSymbol.js';
import type { ISourceIndex } from '../source/ISourceIndex.js';
import type { IFileSystem } from '../filesystem/IFileSystem.js';

/**
 * Contract for the Language Service.
 *
 * Provides lightweight code analysis, extracting symbols (classes,
 * interfaces, functions, methods, types, enums, variables, imports,
 * exports) from file contents without binding to heavyweight compiler tools.
 */
export interface ILanguageService {
  /**
   * Detects the language type for the given file path based on its extension.
   *
   * @param path The file path.
   * @returns The detected language type.
   */
  detectLanguage(path: string): LanguageType;

  /**
   * Parses symbols from the given content for the specified language.
   *
   * @param content The source code content.
   * @param language The language type.
   * @param filePath The file path (used for symbol metadata).
   * @param projectId The project identifier (used for deterministic symbol identity).
   * @returns An array of extracted symbols.
   */
  parseSymbols(content: string, language: LanguageType, filePath: string, projectId: string): SourceSymbol[];

  /**
   * Extracts import statements from the given content.
   *
   * @param content The source code content.
   * @param language The language type.
   * @returns An array of import paths.
   */
  extractImports(content: string, language: LanguageType): string[];

  /**
   * Extracts export specifiers from the given content.
   *
   * @param content The source code content.
   * @param language The language type.
   * @returns An array of exported symbol names.
   */
  extractExports(content: string, language: LanguageType): string[];

  /**
   * Enriches a source index by reading file contents through the
   * file system and parsing symbols for each indexed file.
   *
   * @param sourceIndex The source index to enrich.
   * @param fileSystem The file system to read file contents from.
   * @returns The number of files enriched.
   */
  enrichSourceIndex(sourceIndex: ISourceIndex, fileSystem: IFileSystem): number;
}

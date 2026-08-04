import type { ILanguageService } from './ILanguageService.js';
import type { LanguageType } from './LanguageType.js';
import type { SourceSymbol } from '../source/SourceSymbol.js';
import type { ISourceIndex } from '../source/ISourceIndex.js';
import type { IFileSystem } from '../filesystem/IFileSystem.js';
import { LanguageRegistry } from './LanguageRegistry.js';
import { SourceParser } from './SourceParser.js';
import { extname } from '../filesystem/PathUtils.js';

/**
 * Core implementation of the Language Service.
 *
 * Provides lightweight code analysis using a regex/pattern-based
 * fallback parser. Does NOT bind to heavyweight compiler tools.
 */
export class LanguageService implements ILanguageService {
  private readonly registry: LanguageRegistry;
  private readonly parser: SourceParser;

  /**
   * Creates a new language service.
   * @param registry The language registry (defaults to a new instance).
   * @param parser The source parser (defaults to a new instance).
   */
  constructor(registry?: LanguageRegistry, parser?: SourceParser) {
    this.registry = registry ?? new LanguageRegistry();
    this.parser = parser ?? new SourceParser();
  }

  /**
   * The language registry used by this service.
   */
  public getLanguageRegistry(): LanguageRegistry {
    return this.registry;
  }

  /**
   * The source parser used by this service.
   */
  public getParser(): SourceParser {
    return this.parser;
  }

  /**
   * Detects the language type for the given file path based on its extension.
   *
   * @param path The file path.
   * @returns The detected language type.
   */
  public detectLanguage(path: string): LanguageType {
    const extension = extname(path);
    return this.registry.getLanguage(extension);
  }

  /**
   * Parses symbols from the given content for the specified language.
   *
   * @param content The source code content.
   * @param language The language type.
   * @param filePath The file path (used for symbol metadata).
   * @returns An array of extracted symbols.
   */
  public parseSymbols(
    content: string,
    language: LanguageType,
    filePath: string,
  ): SourceSymbol[] {
    return this.parser.parseSymbols(content, language, filePath);
  }

  /**
   * Extracts import statements from the given content.
   *
   * @param content The source code content.
   * @param language The language type.
   * @returns An array of import paths.
   */
  public extractImports(content: string, language: LanguageType): string[] {
    return this.parser.extractImports(content, language);
  }

  /**
   * Enriches a source index by reading file contents through the
   * file system and parsing symbols for each indexed file.
   *
   * @param sourceIndex The source index to enrich.
   * @param fileSystem The file system to read file contents from.
   * @returns The number of files enriched.
   */
  public enrichSourceIndex(sourceIndex: ISourceIndex, fileSystem: IFileSystem): number {
    const files = sourceIndex.getAllFiles();
    let enriched = 0;

    for (const entry of files) {
      if (!fileSystem.exists(entry.path)) {
        continue;
      }
      const content = fileSystem.readFile(entry.path);
      const language = this.detectLanguage(entry.path);
      const symbols = this.parseSymbols(content, language, entry.path);
      if (symbols.length > 0) {
        enriched++;
      }
    }

    return enriched;
  }
}
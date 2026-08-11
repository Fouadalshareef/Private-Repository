import type { SourceSymbol } from '../source/SourceSymbol.js';
import type { ReferenceMap, Reference } from './ReferenceTypes.js';
import { ReferenceKind } from './ReferenceTypes.js';

/**
 * Contract for the Reference Engine.
 *
 * The Reference Engine builds and queries relationships between
 * code entities (files, symbols, imports). It operates on parsed
 * symbols and import data from the {@link LanguageService}.
 *
 * Note: For regex-based parsers, symbol references are approximate.
 * The engine does not perform full semantic analysis.
 */
export interface IReferenceEngine {
  /**
   * Builds a reference map from parsed symbols and file imports.
   *
   * @param symbols The parsed symbols.
   * @param fileImports Map of file path to imported module paths.
   * @returns The constructed reference map.
   */
  buildReferenceMap(symbols: SourceSymbol[], fileImports: Map<string, string[]>): ReferenceMap;

  /**
   * Returns all references of a given kind originating from a symbol.
   *
   * @param map The reference map.
   * @param symbolId The source symbol identity.
   * @param kind The reference kind.
   * @returns An array of references.
   */
  findReferencesFromSymbol(map: ReferenceMap, symbolId: string, kind: ReferenceKind): Reference[];

  /**
   * Returns all references pointing to a symbol by name.
   *
   * @param map The reference map.
   * @param symbolName The target symbol name.
   * @returns An array of references.
   */
  findReferencesToSymbol(map: ReferenceMap, symbolName: string): Reference[];

  /**
   * Returns all imports for a given file.
   *
   * @param map The reference map.
   * @param filePath The file path.
   * @returns An array of imported module paths.
   */
  getFileImports(map: ReferenceMap, filePath: string): readonly string[];

  /**
   * Returns all symbols referenced by a given symbol.
   *
   * @param map The reference map.
   * @param symbolId The source symbol identity.
   * @returns An array of referenced symbol names.
   */
  getSymbolReferences(map: ReferenceMap, symbolId: string): readonly string[];
}

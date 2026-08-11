import type { SourceSymbol } from '../source/SourceSymbol.js';

/**
 * Contract for a symbol store that indexes code symbols by project,
 * file, name, kind, and stable identity.
 *
 * The store enforces project isolation and deterministic symbol identities.
 */
export interface ISymbolStore {
  /**
   * Adds a single symbol to the store.
   *
   * @param symbol The symbol to add.
   * @throws {DuplicateSymbolError} If a symbol with the same identity already exists.
   */
  addSymbol(symbol: SourceSymbol): void;

  /**
   * Adds multiple symbols to the store.
   *
   * @param symbols The symbols to add.
   * @throws {DuplicateSymbolError} If any symbol identity already exists.
   */
  addSymbols(symbols: SourceSymbol[]): void;

  /**
   * Replaces all symbols for a given file with the provided symbols.
   *
   * This is the preferred way to update symbols after re-parsing a file,
   * because it avoids duplicate identity errors for unchanged symbols.
   *
   * @param projectId The project identifier.
   * @param filePath The file path.
   * @param symbols The new symbols for the file.
   */
  updateSymbolsForFile(projectId: string, filePath: string, symbols: SourceSymbol[]): void;

  /**
   * Returns a symbol by its stable identity.
   *
   * @param id The symbol identity.
   * @returns The symbol, or undefined if not found.
   */
  getSymbol(id: string): SourceSymbol | undefined;

  /**
   * Returns all symbols with the given name.
   *
   * @param name The symbol name.
   * @returns An array of matching symbols.
   */
  getSymbolsByName(name: string): SourceSymbol[];

  /**
   * Returns all symbols of the given kind.
   *
   * @param kind The symbol kind (e.g. 'class', 'function', 'interface').
   * @returns An array of matching symbols.
   */
  getSymbolsByKind(kind: string): SourceSymbol[];

  /**
   * Returns all symbols in the given file.
   *
   * @param projectId The project identifier.
   * @param filePath The file path.
   * @returns An array of matching symbols.
   */
  getSymbolsByFile(projectId: string, filePath: string): SourceSymbol[];

  /**
   * Returns all symbols in the given project.
   *
   * @param projectId The project identifier.
   * @returns An array of matching symbols.
   */
  getSymbolsByProject(projectId: string): SourceSymbol[];

  /**
   * Returns all symbols in the store.
   *
   * @returns An array of all symbols.
   */
  getAllSymbols(): SourceSymbol[];

  /**
   * Returns whether the store contains a symbol with the given identity.
   *
   * @param id The symbol identity.
   * @returns `true` if the symbol exists, `false` otherwise.
   */
  hasSymbol(id: string): boolean;

  /**
   * Removes all symbols for a given file.
   *
   * @param projectId The project identifier.
   * @param filePath The file path.
   */
  removeSymbolsForFile(projectId: string, filePath: string): void;

  /**
   * Removes all symbols for a given project.
   *
   * @param projectId The project identifier.
   */
  clearProject(projectId: string): void;

  /**
   * Clears all symbols from the store.
   */
  clear(): void;
}

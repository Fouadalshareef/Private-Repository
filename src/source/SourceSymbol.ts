/**
 * Represents a symbol in a source file.
 *
 * Symbols are placeholders only — no source code parsing is performed.
 * When parsing is implemented in a future task, symbols will be
 * populated with actual code elements (classes, functions, etc.).
 */
export interface SourceSymbol {
  /** The name of the symbol. */
  readonly name: string;

  /** The kind of the symbol. Always `unknown` since no parsing is done. */
  readonly kind: string;

  /** The path of the file containing the symbol. */
  readonly filePath: string;

  /** The line number of the symbol (0 since line data is not parsed). */
  readonly line: number;
}
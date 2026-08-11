/**
 * Represents a symbol in a source file.
 *
 * Symbols are extracted by the {@link SourceParser} and stored in the
 * {@link SymbolStore}. They represent code elements such as classes,
 * functions, interfaces, types, and variables.
 */
export interface SourceSymbol {
  /** The stable, deterministic identifier of the symbol. */
  readonly id: string;

  /** The identifier of the project this symbol belongs to. */
  readonly projectId: string;

  /** The name of the symbol. */
  readonly name: string;

  /** The kind of the symbol (e.g. 'class', 'function', 'interface', 'type', 'enum', 'variable'). */
  readonly kind: string;

  /** The path of the file containing the symbol. */
  readonly filePath: string;

  /** The 1-based line number of the symbol. */
  readonly line: number;

  /** The parent symbol name, if any (e.g. class name for a method). */
  readonly parentName?: string;

  /** The qualified name of the symbol (e.g. 'ClassName.methodName'). */
  readonly qualifiedName?: string;

  /** Access modifiers detected for the symbol. */
  readonly modifiers?: readonly string[];

  /** The signature or declaration text of the symbol, if available. */
  readonly signature?: string;

  /** Module/specifier paths referenced by this symbol, if any. */
  readonly references?: readonly string[];
}

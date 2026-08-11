/**
 * Kinds of references between code entities.
 */
export class ReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReferenceError';
  }
}

/**
 * Error thrown when a referenced symbol cannot be resolved.
 */
export class UnresolvedReferenceError extends ReferenceError {
  constructor(public readonly reference: string) {
    super(`Unresolved reference: ${reference}`);
    this.name = 'UnresolvedReferenceError';
  }
}

/**
 * Kinds of references between code entities.
 */
export enum ReferenceKind {
  /** A file imports another module. */
  IMPORT = 'import',
  /** A symbol definition. */
  DEFINITION = 'definition',
  /** An approximate reference to a symbol (regex-based). */
  REFERENCE = 'reference',
  /** A function call. */
  CALL = 'call',
}

/**
 * A single reference relationship between two code entities.
 */
export interface Reference {
  readonly kind: ReferenceKind;
  readonly fromId: string;
  readonly fromName: string;
  readonly toId?: string;
  readonly toName: string;
  readonly filePath: string;
  readonly line: number;
}

/**
 * Result of building a reference map from parsed symbols and imports.
 */
export interface ReferenceMap {
  /** All references discovered. */
  readonly references: readonly Reference[];
  /** File-level import relationships: filePath -> imported paths. */
  readonly fileImports: ReadonlyMap<string, readonly string[]>;
  /** Symbol-level references: symbolId -> referenced symbol names. */
  readonly symbolReferences: ReadonlyMap<string, readonly string[]>;
}

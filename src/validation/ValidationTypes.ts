/**
 * Severity levels for validation messages.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when validation cannot proceed because the project
 * configuration is missing.
 */
export class ValidationConfigMissingError extends ValidationError {
  constructor(public readonly configPath: string) {
    super(`Validation configuration not found: ${configPath}`);
    this.name = 'ValidationConfigMissingError';
  }
}

/**
 * Severity levels for validation messages.
 */
export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

/**
 * A single validation message.
 */
export interface ValidationMessage {
  readonly severity: ValidationSeverity;
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  readonly message: string;
  readonly code?: string;
}

/**
 * Result of a validation run.
 */
export interface ValidationResult {
  /** Whether validation passed (no errors). */
  readonly valid: boolean;
  /** The validation messages. */
  readonly messages: readonly ValidationMessage[];
  /** The duration in milliseconds. */
  readonly durationMs: number;
}

/**
 * Type of validation to run.
 */
export enum ValidationType {
  /** TypeScript type-check via `tsc --noEmit`. */
  TYPESCRIPT = 'typescript',
  /** Project test suite. */
  TESTS = 'tests',
  /** Basic syntax check via the parser. */
  SYNTAX = 'syntax',
}

/**
 * Options for validation.
 */
export interface ValidationOptions {
  /** The types of validation to run. */
  readonly types: readonly ValidationType[];
  /** The project root path. */
  readonly projectPath: string;
  /** Whether to continue on validation failure. */
  readonly continueOnError?: boolean;
}

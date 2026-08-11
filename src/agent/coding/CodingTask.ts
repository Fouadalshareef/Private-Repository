import type { DiffResult } from '../../diff/DiffResult.js';
import type { ValidationResult } from '../../validation/ValidationTypes.js';

/**
 * Represents the status of a coding task execution.
 */
export enum CodingTaskStatus {
  /** The task was completed successfully. */
  SUCCESS = 'success',
  /** The request was invalid. */
  INVALID_REQUEST = 'invalid_request',
  /** Context building failed. */
  CONTEXT_ERROR = 'context_error',
  /** The AI provider failed. */
  AI_ERROR = 'ai_error',
  /** A tool operation failed. */
  TOOL_ERROR = 'tool_error',
  /** The proposed patch could not be applied. */
  PATCH_ERROR = 'patch_error',
  /** Validation of the proposed change failed. */
  VALIDATION_FAILED = 'validation_failed',
  /** The execution failed for an unspecified reason. */
  EXECUTION_FAILED = 'execution_failed',
}

/**
 * A request to execute a coding task.
 */
export interface CodingTaskRequest {
  /** The natural language prompt describing the coding task. */
  readonly prompt: string;
  /** The project root path. */
  readonly projectPath: string;
  /** Optional explicit target file path. */
  readonly targetFilePath?: string;
}

/**
 * A single proposed change to a file.
 */
export interface ProposedFileChange {
  /** The path of the file to modify. */
  readonly filePath: string;
  /** The complete updated content of the file. */
  readonly newContent: string;
}

/**
 * The result of a coding task execution.
 */
export interface CodingTaskResult {
  /** The final status of the task. */
  readonly status: CodingTaskStatus;
  /** The original request. */
  readonly request: string;
  /** The files that were modified. */
  readonly modifiedFiles: readonly string[];
  /** The proposed changes. */
  readonly proposedChanges: readonly ProposedFileChange[];
  /** The diff results for each modified file. */
  readonly diffs: ReadonlyMap<string, DiffResult>;
  /** The validation result after applying changes. */
  readonly validationResult: ValidationResult | undefined;
  /** Any errors that occurred during execution. */
  readonly errors: readonly string[];
  /** The duration of the execution in milliseconds. */
  readonly durationMs: number;
}

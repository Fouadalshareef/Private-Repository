import type { CLIConfig } from './CLIConfig.js';
import type { CodingTaskResult } from '../agent/coding/CodingTask.js';
import { CodingTaskPipeline } from '../agent/coding/CodingTaskPipeline.js';
import { CodingTaskStatus } from '../agent/coding/CodingTask.js';
import { WorkspaceState } from '../workspace/WorkspaceState.js';

import { ProjectScanner } from '../project/ProjectScanner.js';
import { ProjectModelBuilder } from '../model/ProjectModelBuilder.js';
import { SourceIndex } from '../source/SourceIndex.js';

/**
 * Options for executing an interactive coding request.
 */
export interface CodingRequestOptions {
  /** The natural-language coding request from the user. */
  readonly prompt: string;
  /**
   * The project root path.
   * Defaults to the active workspace root when not provided.
   */
  readonly projectPath?: string;
  /** Optional explicit target file path (relative or absolute). */
  readonly targetFilePath?: string;
}

/**
 * Result of an interactive coding execution.
 *
 * Wraps the underlying {@link CodingTaskResult} with an additional
 * user-facing error message for workspace/validation errors that occur
 * before or outside the pipeline.
 */
export interface InteractiveCodingResult {
  /** Whether the request was accepted by the interactive layer. */
  readonly accepted: boolean;
  /** User-facing error message when the request was rejected before pipeline execution. */
  readonly userError?: string;
  /** The pipeline result when the request reached the coding pipeline. */
  readonly taskResult?: CodingTaskResult;
}

/**
 * Interactive Coding Session.
 *
 * Provides the user-facing bridge between the CLI/REPL and the
 * {@link CodingTaskPipeline}. Responsibilities:
 *
 * - Validate that a workspace is active before running.
 * - Validate that the request prompt is non-empty.
 * - Translate CLI input into a {@link CodingTaskRequest}.
 * - Build the latest SourceIndex from the Workspace.
 * - Execute the existing {@link CodingTaskPipeline} (no safety bypass).
 * - Print progress steps to stdout.
 * - Format and print success/failure results.
 * - Expose the raw result for programmatic use (e.g. tests).
 *
 * This class does NOT:
 * - Write files directly — all writes go through PatchEngine → IFileSystem.
 * - Bypass ValidationEngine or DiffEngine.
 * - Duplicate CodingTaskPipeline logic.
 * - Introduce a second AI provider or approval mechanism.
 */
export class InteractiveCodingSession {
  private readonly config: CLIConfig;

  constructor(config: CLIConfig) {
    this.config = config;
  }

  /**
   * Executes a user coding request through the full pipeline.
   *
   * Prints progress to stdout and returns the structured result.
   * Never throws — all errors are surfaced in the returned result.
   */
  public async executeRequest(options: CodingRequestOptions): Promise<InteractiveCodingResult> {
    const { prompt, projectPath, targetFilePath } = options;

    // Guard: non-empty prompt.
    if (!prompt || prompt.trim().length === 0) {
      const userError = 'Request cannot be empty. Please describe the coding task.';
      console.log(`\n✗ ${userError}\n`);
      return { accepted: false, userError };
    }

    // Guard: workspace must be open.
    if (!this.config.workspace.isOpen()) {
      const userError = 'No active workspace. Please open a project before submitting a coding request.';
      console.log(`\n✗ ${userError}\n`);
      return { accepted: false, userError };
    }

    // Resolve project path: prefer explicit, fall back to workspace root.
    let resolvedProjectPath: string;
    try {
      resolvedProjectPath = projectPath ?? this.config.workspace.getRoot();
    } catch {
      const userError = 'Workspace has not been configured with a project path.';
      console.log(`\n✗ ${userError}\n`);
      return { accepted: false, userError };
    }

    // Validate that workspace state is truly open.
    if (this.config.workspace.getState() !== WorkspaceState.OPEN) {
      const userError = 'Workspace is not open. Please open a project first.';
      console.log(`\n✗ ${userError}\n`);
      return { accepted: false, userError };
    }

    console.log('\nUnderstanding request...');
    this.config.logger.info(`[InteractiveCodingSession] Starting: ${prompt}`);

    const taskResult = await this.runPipeline(prompt.trim(), resolvedProjectPath, targetFilePath);
    this.printResult(taskResult);

    return { accepted: true, taskResult };
  }

  /**
   * Delegates to the CodingTaskPipeline. All AI, Diff, Patch, and Validation
   * steps happen inside the pipeline — this method only forwards the call.
   */
  private async runPipeline(
    prompt: string,
    projectPath: string,
    targetFilePath?: string,
  ): Promise<CodingTaskResult> {
    console.log('Building context...');
    
    // 1. Scan the project
    const scanner = new ProjectScanner(this.config.fileSystem);
    const scanResult = scanner.scan(this.config.workspace);
    
    // 2. Build the project model and source index
    const builder = new ProjectModelBuilder();
    const projectModel = builder.build(scanResult);
    const sourceIndex = new SourceIndex();
    sourceIndex.build(projectModel);

    // 3. Re-instantiate the pipeline with the fresh source index
    const pipeline = new CodingTaskPipeline({
      fileSystem: this.config.fileSystem,
      aiProvider: this.config.aiProvider,
      sourceIndex,
    });

    console.log('Consulting AI...');
    console.log('Preparing changes...');
    console.log('Validating changes...');
    console.log('Applying changes...');

    const result = await pipeline.execute({
      prompt,
      projectPath,
      targetFilePath,
    });

    this.config.logger.info(
      `[InteractiveCodingSession] Pipeline status: ${result.status} (${result.durationMs}ms)`,
    );

    return result;
  }

  /**
   * Formats and prints the pipeline result to stdout.
   */
  private printResult(result: CodingTaskResult): void {
    if (result.status === CodingTaskStatus.SUCCESS) {
      this.printSuccess(result);
    } else {
      this.printFailure(result);
    }
  }

  /**
   * Prints a success result.
   */
  private printSuccess(result: CodingTaskResult): void {
    console.log('\n✓ Task completed\n');

    if (result.modifiedFiles.length > 0) {
      console.log('Modified files:');
      for (const file of result.modifiedFiles) {
        console.log(`  ${file}`);
      }
      console.log('');
    }

    if (result.validationResult !== undefined) {
      const label = result.validationResult.valid ? '✓ TypeScript' : '✗ TypeScript';
      console.log(`Validation:\n  ${label}\n`);
    }

    if (result.proposedChanges.length > 0) {
      console.log('Changes:');
      for (const change of result.proposedChanges) {
        const diff = result.diffs.get(change.filePath);
        if (diff) {
          if (diff.addedLines > 0) {
            console.log(`  + ${diff.addedLines} line(s) added in ${change.filePath}`);
          }
          if (diff.removedLines > 0) {
            console.log(`  - ${diff.removedLines} line(s) removed in ${change.filePath}`);
          }
        }
      }
      console.log('');
    }
  }

  /**
   * Prints a failure result with a human-readable reason.
   */
  private printFailure(result: CodingTaskResult): void {
    console.log('\n✗ Task failed\n');
    console.log(`Reason:\n  ${this.describeFailure(result)}\n`);

    if (result.errors.length > 0) {
      const displayErrors = result.errors.filter(
        (e) => e !== this.describeFailure(result),
      );
      if (displayErrors.length > 0) {
        console.log('Details:');
        for (const error of displayErrors) {
          console.log(`  ${error}`);
        }
        console.log('');
      }
    }

    if (
      result.status !== CodingTaskStatus.PATCH_ERROR &&
      result.status !== CodingTaskStatus.VALIDATION_FAILED
    ) {
      console.log('No changes were applied.\n');
    } else {
      console.log('No unsafe changes were applied.\n');
    }
  }

  /**
   * Returns a short human-readable description of the failure reason.
   */
  private describeFailure(result: CodingTaskResult): string {
    switch (result.status) {
      case CodingTaskStatus.INVALID_REQUEST:
        return 'Invalid request: the prompt was empty or malformed.';
      case CodingTaskStatus.CONTEXT_ERROR:
        return 'No relevant files found for the request. Please mention a specific file or symbol.';
      case CodingTaskStatus.AI_ERROR:
        return 'AI provider failed or returned an unusable response.';
      case CodingTaskStatus.TOOL_ERROR:
        return 'File system error: could not read required files.';
      case CodingTaskStatus.VALIDATION_FAILED:
        return result.validationResult
          ? 'TypeScript validation failed — unsafe changes were not applied.'
          : 'Validation failed — unsafe changes were not applied.';
      case CodingTaskStatus.PATCH_ERROR:
        return 'Patch application failed — unsafe changes were not applied.';
      case CodingTaskStatus.EXECUTION_FAILED:
        return 'An unexpected error occurred during execution.';
      default:
        return 'Unknown failure.';
    }
  }
}

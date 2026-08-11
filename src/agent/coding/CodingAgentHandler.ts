import type { AgentExecutionContext } from '../agent-context.js';
import type { AgentStepResult } from '../types.js';
import type { CodingTaskRequest } from './CodingTask.js';
import type { IFileSystem } from '../../filesystem/IFileSystem.js';
import type { IAIProvider } from '../../ai/IAIProvider.js';
import type { ISourceIndex } from '../../source/ISourceIndex.js';
import type { ISymbolStore } from '../../symbol/ISymbolStore.js';
import type { IReferenceEngine } from '../../reference/IReferenceEngine.js';
import { CodingTaskPipeline } from './CodingTaskPipeline.js';

/**
 * Creates an agent execution handler for coding tasks.
 *
 * The handler integrates with the existing {@link BaseAgent} lifecycle
 * and delegates the actual coding work to {@link CodingTaskPipeline}.
 */
export function createCodingAgentHandler(config: {
  fileSystem: IFileSystem;
  aiProvider: IAIProvider;
  sourceIndex?: ISourceIndex;
  symbolStore?: ISymbolStore;
  referenceEngine?: IReferenceEngine;
  maxContextFiles?: number;
}): (input: unknown, _context: AgentExecutionContext) => Promise<AgentStepResult> {
  const pipeline = new CodingTaskPipeline({
    fileSystem: config.fileSystem,
    aiProvider: config.aiProvider,
    sourceIndex: config.sourceIndex,
    symbolStore: config.symbolStore,
    referenceEngine: config.referenceEngine,
    maxContextFiles: config.maxContextFiles,
  });

  return async (input: unknown): Promise<AgentStepResult> => {
    const request = input as CodingTaskRequest;
    const result = await pipeline.execute(request);

    return {
      output: result,
      metadata: {
        status: result.status,
        modifiedFiles: result.modifiedFiles,
        durationMs: result.durationMs,
      },
    };
  };
}

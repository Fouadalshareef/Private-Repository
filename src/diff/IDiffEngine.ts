import type { DiffResult } from './DiffResult.js';

/**
 * Contract for the Diff Engine.
 *
 * Computes structured diffs between text contents. The engine does NOT
 * modify files; it only computes and returns diff information.
 */
export interface IDiffEngine {
  /**
   * Computes a diff between two text contents.
   *
   * @param oldContent The original content.
   * @param newContent The new content.
   * @returns The diff result.
   */
  computeDiff(oldContent: string, newContent: string): DiffResult;

  /**
   * Computes a diff between two file contents read through the file system.
   *
   * @param oldPath The path of the original file.
   * @param newPath The path of the new file.
   * @param readFile A function to read file content.
   * @returns The diff result.
   */
  computeFileDiff(oldPath: string, newPath: string, readFile: (path: string) => string): DiffResult;
}

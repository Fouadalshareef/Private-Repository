import type { DiffResult, DiffEntry } from '../diff/DiffResult.js';
import type { PatchResult } from './PatchResult.js';

/**
 * Contract for the Patch Engine.
 *
 * Applies structured diffs to text content. The Patch Engine never
 * writes directly to the filesystem; it only produces modified content.
 * File I/O must go through the existing {@link IFileSystem} abstraction.
 */
export interface IPatchEngine {
  /**
   * Validates whether a patch can be applied to the given base content.
   *
   * @param baseContent The original content.
   * @param patch The diff to apply.
   * @returns `true` if the patch can be applied, `false` otherwise.
   */
  canApply(baseContent: string, patch: DiffResult): boolean;

  /**
   * Applies a patch to the given base content.
   *
   * @param baseContent The original content.
   * @param patch The diff to apply.
   * @returns The patch result.
   */
  applyPatch(baseContent: string, patch: DiffResult): PatchResult;

  /**
   * Validates that a patch entry matches the expected base content at the
   * given position.
   *
   * @param baseContent The original content.
   * @param entry The diff entry to validate.
   * @returns `true` if the entry matches, `false` otherwise.
   */
  validateEntry(baseContent: string, entry: DiffEntry): boolean;
}

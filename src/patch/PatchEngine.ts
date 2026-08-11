import type { IPatchEngine } from './IPatchEngine.js';
import type { DiffResult, DiffEntry } from '../diff/DiffResult.js';
import type { PatchResult } from './PatchResult.js';

/**
 * Patch Engine implementation.
 *
 * Applies structured line-based diffs to text content. The engine
 * validates that the base content matches before applying each entry,
 * and rejects patches that cannot be applied cleanly.
 */
export class PatchEngine implements IPatchEngine {
  public canApply(baseContent: string, patch: DiffResult): boolean {
    const baseLines = baseContent.split('\n');
    for (const entry of patch.entries) {
      if (!this.validateEntryInternal(baseLines, entry)) {
        return false;
      }
    }
    return true;
  }

  public applyPatch(baseContent: string, patch: DiffResult): PatchResult {
    const baseLines = baseContent.split('\n');
    const applied: DiffEntry[] = [];

    if (!this.canApply(baseContent, patch)) {
      return {
        success: false,
        error: 'Patch base content does not match expected content',
        appliedEntries: Object.freeze(applied),
      };
    }

    const resultLines: string[] = [];
    let baseIdx = 0;

    for (const entry of patch.entries) {
      switch (entry.type) {
        case 'unchanged': {
          while (baseIdx < (entry.oldLine ?? 1) - 1 && baseIdx < baseLines.length) {
            resultLines.push(baseLines[baseIdx]);
            baseIdx++;
          }
          resultLines.push(entry.newContent ?? baseLines[baseIdx] ?? '');
          baseIdx++;
          applied.push(entry);
          break;
        }
        case 'added': {
          while (resultLines.length < (entry.newLine ?? 1) - 1 && baseIdx < baseLines.length) {
            resultLines.push(baseLines[baseIdx]);
            baseIdx++;
          }
          resultLines.push(entry.newContent ?? '');
          applied.push(entry);
          break;
        }
        case 'removed': {
          while (baseIdx < (entry.oldLine ?? 1) - 1 && baseIdx < baseLines.length) {
            resultLines.push(baseLines[baseIdx]);
            baseIdx++;
          }
          if (baseIdx < baseLines.length) {
            baseIdx++;
          }
          applied.push(entry);
          break;
        }
        case 'modified': {
          while (baseIdx < (entry.oldLine ?? 1) - 1 && baseIdx < baseLines.length) {
            resultLines.push(baseLines[baseIdx]);
            baseIdx++;
          }
          resultLines.push(entry.newContent ?? '');
          if (baseIdx < baseLines.length) {
            baseIdx++;
          }
          applied.push(entry);
          break;
        }
      }
    }

    while (baseIdx < baseLines.length) {
      resultLines.push(baseLines[baseIdx]);
      baseIdx++;
    }

    return {
      success: true,
      content: resultLines.join('\n'),
      appliedEntries: Object.freeze(applied),
    };
  }

  public validateEntry(baseContent: string, entry: DiffEntry): boolean {
    const baseLines = baseContent.split('\n');
    return this.validateEntryInternal(baseLines, entry);
  }

  private validateEntryInternal(baseLines: string[], entry: DiffEntry): boolean {
    if (entry.type === 'unchanged' || entry.type === 'modified') {
      const oldLine = entry.oldLine ?? 0;
      if (oldLine === 0) {
        return true;
      }
      if (oldLine < 1 || oldLine > baseLines.length) {
        return false;
      }
      return baseLines[oldLine - 1] === entry.oldContent;
    }
    if (entry.type === 'removed') {
      const oldLine = entry.oldLine ?? 0;
      if (oldLine === 0) {
        return true;
      }
      if (oldLine < 1 || oldLine > baseLines.length) {
        return false;
      }
      return baseLines[oldLine - 1] === entry.oldContent;
    }
    if (entry.type === 'added') {
      return true;
    }
    return false;
  }
}

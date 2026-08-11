import type { IDiffEngine } from './IDiffEngine.js';
import type { DiffResult, DiffEntry } from './DiffResult.js';

/**
 * Diff Engine implementation.
 *
 * Computes line-based structured diffs using a simple LCS (Longest
 * Common Subsequence) algorithm. Suitable for MVP use cases where
 * full Myers diff precision is not required.
 */
export class DiffEngine implements IDiffEngine {
  public computeDiff(oldContent: string, newContent: string): DiffResult {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    return this.computeLineDiff(oldLines, newLines);
  }

  public computeFileDiff(oldPath: string, newPath: string, readFile: (path: string) => string): DiffResult {
    const oldContent = readFile(oldPath);
    const newContent = readFile(newPath);
    return this.computeDiff(oldContent, newContent);
  }

  private computeLineDiff(oldLines: string[], newLines: string[]): DiffResult {
    const lcs = this.computeLCS(oldLines, newLines);
    const entries: DiffEntry[] = [];
    let addedLines = 0;
    let removedLines = 0;
    let modifiedLines = 0;

    let oldIdx = 0;
    let newIdx = 0;
    let lcsIdx = 0;

    while (oldIdx < oldLines.length || newIdx < newLines.length) {
      if (lcsIdx < lcs.length && oldIdx < oldLines.length && oldLines[oldIdx] === lcs[lcsIdx] && newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx]) {
        entries.push({
          type: 'unchanged',
          oldLine: oldIdx + 1,
          newLine: newIdx + 1,
          oldContent: oldLines[oldIdx],
          newContent: newLines[newIdx],
        });
        oldIdx++;
        newIdx++;
        lcsIdx++;
      } else if (newIdx < newLines.length && (lcsIdx >= lcs.length || newLines[newIdx] !== lcs[lcsIdx])) {
        if (oldIdx < oldLines.length && (lcsIdx >= lcs.length || oldLines[oldIdx] !== lcs[lcsIdx])) {
          entries.push({
            type: 'modified',
            oldLine: oldIdx + 1,
            newLine: newIdx + 1,
            oldContent: oldLines[oldIdx],
            newContent: newLines[newIdx],
          });
          modifiedLines++;
          oldIdx++;
          newIdx++;
        } else {
          entries.push({
            type: 'added',
            newLine: newIdx + 1,
            newContent: newLines[newIdx],
          });
          addedLines++;
          newIdx++;
        }
      } else if (oldIdx < oldLines.length) {
        entries.push({
          type: 'removed',
          oldLine: oldIdx + 1,
          oldContent: oldLines[oldIdx],
        });
        removedLines++;
        oldIdx++;
      }
    }

    return {
      isIdentical: addedLines === 0 && removedLines === 0 && modifiedLines === 0,
      entries: Object.freeze(entries),
      addedLines,
      removedLines,
      modifiedLines,
    };
  }

  private computeLCS(a: string[], b: string[]): string[] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    const result: string[] = [];
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) {
        result.unshift(a[i - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    return result;
  }
}

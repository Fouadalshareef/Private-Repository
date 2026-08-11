import { describe, it, expect } from 'vitest';
import { PatchEngine } from '../../src/patch/PatchEngine.js';
import { DiffEngine } from '../../src/diff/DiffEngine.js';

describe('PatchEngine', () => {
  const diffEngine = new DiffEngine();
  const patchEngine = new PatchEngine();

  it('applies a valid patch', () => {
    const oldContent = 'a\nb\nc';
    const newContent = 'a\nx\nc';
    const diff = diffEngine.computeDiff(oldContent, newContent);
    const result = patchEngine.applyPatch(oldContent, diff);

    expect(result.success).toBe(true);
    expect(result.content).toBe(newContent);
  });

  it('rejects a patch with base mismatch', () => {
    const oldContent = 'a\nb\nc';
    const newContent = 'a\nx\nc';
    const diff = diffEngine.computeDiff(oldContent, newContent);
    const wrongBase = 'a\nz\nc';
    const result = patchEngine.applyPatch(wrongBase, diff);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Patch base content does not match expected content');
  });

  it('reports no unintended modification on identical content', () => {
    const content = 'a\nb\nc';
    const diff = diffEngine.computeDiff(content, content);
    const result = patchEngine.applyPatch(content, diff);

    expect(result.success).toBe(true);
    expect(result.content).toBe(content);
    expect(result.appliedEntries).toHaveLength(3);
  });

  it('validates patch entries', () => {
    const content = 'a\nb\nc';
    const diff = diffEngine.computeDiff(content, 'a\nx\nc');
    expect(patchEngine.canApply(content, diff)).toBe(true);
  });

  it('returns false for invalid base', () => {
    const content = 'a\nb\nc';
    const diff = diffEngine.computeDiff(content, 'a\nx\nc');
    expect(patchEngine.canApply('wrong\nbase', diff)).toBe(false);
  });
});

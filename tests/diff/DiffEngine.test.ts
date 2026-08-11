import { describe, it, expect } from 'vitest';
import { DiffEngine } from '../../src/diff/DiffEngine.js';

describe('DiffEngine', () => {
  it('returns identical for same content', () => {
    const engine = new DiffEngine();
    const result = engine.computeDiff('a\nb\nc', 'a\nb\nc');
    expect(result.isIdentical).toBe(true);
    expect(result.addedLines).toBe(0);
    expect(result.removedLines).toBe(0);
    expect(result.modifiedLines).toBe(0);
  });

  it('detects added lines', () => {
    const engine = new DiffEngine();
    const result = engine.computeDiff('a\nb', 'a\nb\nc');
    expect(result.isIdentical).toBe(false);
    expect(result.addedLines).toBe(1);
    expect(result.removedLines).toBe(0);
  });

  it('detects removed lines', () => {
    const engine = new DiffEngine();
    const result = engine.computeDiff('a\nb\nc', 'a\nb');
    expect(result.isIdentical).toBe(false);
    expect(result.removedLines).toBe(1);
    expect(result.addedLines).toBe(0);
  });

  it('detects modified lines', () => {
    const engine = new DiffEngine();
    const result = engine.computeDiff('a\nb', 'a\nc');
    expect(result.isIdentical).toBe(false);
    expect(result.modifiedLines).toBe(1);
  });

  it('handles multiple files diff', () => {
    const engine = new DiffEngine();
    const result = engine.computeDiff('a\nb\nc\nd', 'a\nx\nc\ny');
    expect(result.isIdentical).toBe(false);
    expect(result.modifiedLines).toBe(2);
  });

  it('produces structured entries', () => {
    const engine = new DiffEngine();
    const result = engine.computeDiff('a\nb', 'a\nc');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].type).toBe('unchanged');
    expect(result.entries[1].type).toBe('modified');
  });

  it('supports file diff via readFile function', () => {
    const engine = new DiffEngine();
    const result = engine.computeFileDiff('old.txt', 'new.txt', (path) => {
      return path === 'old.txt' ? 'a\nb' : 'a\nc';
    });
    expect(result.isIdentical).toBe(false);
    expect(result.modifiedLines).toBe(1);
  });
});

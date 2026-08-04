import { describe, it, expect } from 'vitest';
import { normalize, join, dirname, basename, extname } from '../src/filesystem/PathUtils.js';

describe('PathUtils', () => {
  // ── normalize ────────────────────────────────────────────────

  it('should normalize an empty string', () => {
    expect(normalize('')).toBe('');
  });

  it('should normalize the root path', () => {
    expect(normalize('/')).toBe('/');
  });

  it('should replace backslashes with forward slashes', () => {
    expect(normalize('\\a\\b\\c.txt')).toBe('/a/b/c.txt');
  });

  it('should collapse duplicate separators', () => {
    expect(normalize('/a//b///c.txt')).toBe('/a/b/c.txt');
  });

  it('should resolve dot segments', () => {
    expect(normalize('/a/./b/./c.txt')).toBe('/a/b/c.txt');
  });

  it('should resolve parent segments', () => {
    expect(normalize('/a/b/../c.txt')).toBe('/a/c.txt');
  });

  it('should remove trailing separators', () => {
    expect(normalize('/a/b/')).toBe('/a/b');
  });

  // ── join ─────────────────────────────────────────────────────

  it('should join path segments', () => {
    expect(join('/a', 'b', 'c.txt')).toBe('/a/b/c.txt');
  });

  it('should join empty segments', () => {
    expect(join('/a', '', 'b')).toBe('/a/b');
  });

  it('should join with no segments', () => {
    expect(join()).toBe('');
  });

  it('should ignore empty segments entirely', () => {
    expect(join('', '', '')).toBe('');
  });

  // ── dirname ──────────────────────────────────────────────────

  it('should return the directory of a nested path', () => {
    expect(dirname('/a/b/c.txt')).toBe('/a/b');
  });

  it('should return the root for a top-level path', () => {
    expect(dirname('/file.txt')).toBe('/');
  });

  it('should return empty for a bare filename', () => {
    expect(dirname('file.txt')).toBe('');
  });

  it('should return root for root', () => {
    expect(dirname('/')).toBe('/');
  });

  // ── basename ─────────────────────────────────────────────────

  it('should return the final segment of a nested path', () => {
    expect(basename('/a/b/c.txt')).toBe('c.txt');
  });

  it('should return the filename for a top-level path', () => {
    expect(basename('/file.txt')).toBe('file.txt');
  });

  it('should return the directory name for a directory path', () => {
    expect(basename('/a/b/')).toBe('b');
  });

  it('should return empty for root', () => {
    expect(basename('/')).toBe('');
  });

  it('should return the path for a bare filename', () => {
    expect(basename('file.txt')).toBe('file.txt');
  });

  // ── extname ──────────────────────────────────────────────────

  it('should return the extension of a file', () => {
    expect(extname('/a/b/file.ts')).toBe('.ts');
  });

  it('should return empty when there is no extension', () => {
    expect(extname('/a/b/file')).toBe('');
  });

  it('should handle files with multiple dots', () => {
    expect(extname('/a/b/file.test.ts')).toBe('.ts');
  });

  it('should handle dotfiles', () => {
    expect(extname('/a/b/.gitignore')).toBe('');
  });

  it('should return empty for a directory path', () => {
    expect(extname('/a/b/folder/')).toBe('');
  });

  it('should return empty for empty string', () => {
    expect(extname('')).toBe('');
  });
});
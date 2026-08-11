import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ValidationEngine } from '../../src/validation/ValidationEngine.js';
import { ValidationSeverity } from '../../src/validation/ValidationTypes.js';
import type { IFileSystem } from '../../src/filesystem/IFileSystem.js';

class FakeFileSystem implements IFileSystem {
  exists(path: string): boolean {
    return this.files.has(path) || this.dirs.has(path);
  }
  readFile(path: string): string {
    if (!this.files.has(path)) throw new Error(`File not found: ${path}`);
    return this.files.get(path)!;
  }
  writeFile(path: string, content: string): void { this.files.set(path, content); }
  delete(path: string): void { this.files.delete(path); }
  move(source: string, destination: string): void { this.files.set(destination, this.files.get(source)!); this.files.delete(source); }
  copy(source: string, destination: string): void { this.files.set(destination, this.files.get(source)!); }
  createDirectory(path: string): void { this.dirs.add(path); }
  deleteDirectory(path: string): void { this.dirs.delete(path); }
  list(_path: string): Array<{ path: string; name: string; isDirectory: boolean; size: number; createdAt: number; modifiedAt: number }> {
    void _path;
    return [];
  }
  stat(path: string) {
    const isDir = this.dirs.has(path);
    return {
      isDirectory: isDir,
      path,
      size: isDir ? 0 : (this.files.get(path)?.length ?? 0),
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
  }
  constructor(public files = new Map<string, string>(), public dirs = new Set<string>()) {}
}

describe('ValidationEngine', () => {
  let engine: ValidationEngine;
  let fs: FakeFileSystem;

  beforeEach(() => {
    engine = new ValidationEngine();
    fs = new FakeFileSystem();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates valid TypeScript syntax', () => {
    const result = engine.validateSyntax('class Foo {}', 'typescript', 'foo.ts');
    expect(result.valid).toBe(true);
    expect(result.messages).toHaveLength(0);
  });

  it('reports invalid JSON syntax', () => {
    const result = engine.validateSyntax('{invalid}', 'json', 'config.json');
    expect(result.valid).toBe(false);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].severity).toBe(ValidationSeverity.ERROR);
  });

  it('validates JSON content', () => {
    const result = engine.validateSyntax('{"valid": true}', 'json', 'config.json');
    expect(result.valid).toBe(true);
  });

  it('validates patch content', () => {
    const result = engine.validatePatchContent('a', 'a\nb', 'typescript', 'foo.ts');
    expect(result.valid).toBe(true);
  });

  it('reports patch content with invalid JSON', () => {
    const result = engine.validatePatchContent('a', '{invalid}', 'json', 'config.json');
    expect(result.valid).toBe(false);
  });

  it('skips TypeScript validation when tsconfig is missing', async () => {
    fs.files.set('tsconfig.json', '{}');
    fs.dirs.add('');
    const result = await engine.validateTypeScript('', fs);
    expect(result.valid).toBe(true);
  });
});

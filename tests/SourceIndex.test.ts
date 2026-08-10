import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SourceIndex } from '../src/source/SourceIndex.js';
import { ProjectModelBuilder } from '../src/model/ProjectModelBuilder.js';
import {
  SourceIndexNotBuiltError,
  SourceFileNotFoundError,
} from '../src/source/SourceIndexError.js';
import { SourceIndexEvents } from '../src/source/SourceIndexEvents.js';
import { LanguageType } from '../src/language/LanguageType.js';
import type { ISourceIndex } from '../src/source/ISourceIndex.js';
import type { ProjectScanResult } from '../src/project/ProjectScanResult.js';
import type { ProjectInfo } from '../src/project/ProjectInfo.js';
import type { ProjectFile } from '../src/project/ProjectFile.js';
import type { ProjectDirectory } from '../src/project/ProjectDirectory.js';

/**
 * Creates a scan result for testing.
 */
function createScanResult(): ProjectScanResult {
  const info: ProjectInfo = {
    projectId: 'proj-1',
    projectName: 'Test Project',
    rootPath: '/project',
    createdAt: 1000,
    scannedAt: 2000,
  };

  return createScanResultWithInfo(info);
}

/**
 * Creates a scan result for a project with a custom project id.
 */
function createScanResultWithInfo(info: ProjectInfo): ProjectScanResult {
  const files: ProjectFile[] = [
    { path: 'package.json', name: 'package.json', extension: '.json', size: 10, createdAt: 1000, modifiedAt: 1000 },
    { path: 'src/index.ts', name: 'index.ts', extension: '.ts', size: 20, createdAt: 1000, modifiedAt: 1000 },
    { path: 'src/components/Button.ts', name: 'Button.ts', extension: '.ts', size: 30, createdAt: 1000, modifiedAt: 1000 },
    { path: 'README', name: 'README', extension: '', size: 5, createdAt: 1000, modifiedAt: 1000 },
  ];
  const directories: ProjectDirectory[] = [
    { path: 'src', name: 'src', depth: 0 },
    { path: 'src/components', name: 'components', depth: 1 },
  ];
  return {
    info,
    files,
    directories,
    statistics: {
      totalFiles: files.length,
      totalDirectories: directories.length,
      totalSize: 65,
      extensions: new Map([['.json', 1], ['.ts', 2], ['', 1]]),
    },
  };
}

describe('SourceIndex', () => {
  let index: SourceIndex;
  let model: ReturnType<ProjectModelBuilder['build']>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T00:00:00.000Z'));
    const builder = new ProjectModelBuilder();
    model = builder.build(createScanResult());
    index = new SourceIndex();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── build ────────────────────────────────────────────────────

  it('should build an index from a project model', () => {
    const result = index.build(model);

    expect(result.indexedFiles).toBe(4);
    expect(result.builtAt).toBe(Date.now());
    expect(result.entries.size).toBe(4);
  });

  it('should index all file nodes', () => {
    index.build(model);

    expect(index.size()).toBe(4);
    expect(index.contains('package.json')).toBe(true);
    expect(index.contains('src/index.ts')).toBe(true);
    expect(index.contains('src/components/Button.ts')).toBe(true);
    expect(index.contains('README')).toBe(true);
  });

  it('should not index directory nodes', () => {
    index.build(model);

    expect(index.contains('src')).toBe(false);
    expect(index.contains('src/components')).toBe(false);
  });

  it('should exclude extensionless files when option is false', () => {
    index.build(model, { includeExtensionless: false });

    expect(index.size()).toBe(3);
    expect(index.contains('README')).toBe(false);
  });

  // ── entry metadata ───────────────────────────────────────────

  it('should populate stable identity and structural metadata on entries', () => {
    index.build(model);

    const entry = index.getFile('src/index.ts');
    expect(entry.id).toBe(`proj-1:file:src/index.ts`);
    expect(entry.projectId).toBe('proj-1');
    expect(entry.relativePath).toBe('src/index.ts');
    expect(entry.languageHint).toBe(LanguageType.TYPESCRIPT);
    expect(entry.createdAt).toBe(1000);
    expect(entry.modifiedAt).toBe(1000);
  });

  it('should derive a deterministic language hint from the extension', () => {
    index.build(model);

    expect(index.getFile('package.json').languageHint).toBe(LanguageType.JSON);
    expect(index.getFile('README').languageHint).toBe(LanguageType.UNKNOWN);
  });

  it('should produce a stable id across rebuilds', () => {
    index.build(model);
    const first = index.getFile('src/index.ts').id;

    index.build(model);
    const second = index.getFile('src/index.ts').id;

    expect(second).toBe(first);
  });

  // ── getFile ───────────────────────────────────────────────────

  it('should return a file entry by path', () => {
    index.build(model);

    const entry = index.getFile('src/index.ts');
    expect(entry.path).toBe('src/index.ts');
    expect(entry.name).toBe('index.ts');
    expect(entry.extension).toBe('.ts');
    expect(entry.size).toBe(20);
    expect(entry.parsed).toBe(false);
  });

  it('should throw SourceFileNotFoundError for a missing file', () => {
    index.build(model);

    expect(() => index.getFile('missing.ts')).toThrow(SourceFileNotFoundError);
  });

  it('should throw SourceIndexNotBuiltError before build', () => {
    expect(() => index.getFile('any.ts')).toThrow(SourceIndexNotBuiltError);
  });

  it('should return a defensive copy of the entry', () => {
    index.build(model);

    const entry = index.getFile('src/index.ts') as { name: string };
    entry.name = 'mutated';

    expect(index.getFile('src/index.ts').name).toBe('index.ts');
  });

  // ── getById ──────────────────────────────────────────────────

  it('should return a file entry by stable id', () => {
    index.build(model);

    const entry = index.getById('proj-1:file:src/index.ts');
    expect(entry.path).toBe('src/index.ts');
    expect(entry.projectId).toBe('proj-1');
  });

  it('should throw SourceFileNotFoundError for an unknown id', () => {
    index.build(model);

    expect(() => index.getById('proj-1:missing.ts')).toThrow(SourceFileNotFoundError);
  });

  it('should throw SourceIndexNotBuiltError before build', () => {
    expect(() => index.getById('proj-1:src/index.ts')).toThrow(SourceIndexNotBuiltError);
  });

  // ── getAllFiles ──────────────────────────────────────────────

  it('should return all file entries', () => {
    index.build(model);

    const all = index.getAllFiles();
    expect(all).toHaveLength(4);
    expect(all.map((e) => e.path)).toEqual(
      expect.arrayContaining(['package.json', 'src/index.ts', 'src/components/Button.ts', 'README']),
    );
  });

  it('should throw SourceIndexNotBuiltError before build', () => {
    expect(() => index.getAllFiles()).toThrow(SourceIndexNotBuiltError);
  });

  // ── findFilesByExtension ─────────────────────────────────────

  it('should find files by extension', () => {
    index.build(model);

    const tsFiles = index.findFilesByExtension('.ts');
    expect(tsFiles).toHaveLength(2);
    expect(tsFiles.map((e) => e.path)).toEqual(
      expect.arrayContaining(['src/index.ts', 'src/components/Button.ts']),
    );
  });

  it('should return empty for a non-existent extension', () => {
    index.build(model);

    expect(index.findFilesByExtension('.py')).toEqual([]);
  });

  it('should throw SourceIndexNotBuiltError before build', () => {
    expect(() => index.findFilesByExtension('.ts')).toThrow(SourceIndexNotBuiltError);
  });

  // ── findByLanguage ───────────────────────────────────────────

  it('should find files by language hint', () => {
    index.build(model);

    const tsFiles = index.findByLanguage(LanguageType.TYPESCRIPT);
    expect(tsFiles).toHaveLength(2);
    expect(tsFiles.map((e) => e.path)).toEqual(
      expect.arrayContaining(['src/index.ts', 'src/components/Button.ts']),
    );
  });

  it('should return empty for a language with no files', () => {
    index.build(model);

    expect(index.findByLanguage(LanguageType.PYTHON)).toEqual([]);
  });

  it('should throw SourceIndexNotBuiltError before build', () => {
    expect(() => index.findByLanguage(LanguageType.TYPESCRIPT)).toThrow(SourceIndexNotBuiltError);
  });

  // ── contains ─────────────────────────────────────────────────

  it('should return false before build', () => {
    expect(index.contains('any.ts')).toBe(false);
  });

  it('should return true for indexed files', () => {
    index.build(model);
    expect(index.contains('package.json')).toBe(true);
  });

  it('should return false for non-indexed paths', () => {
    index.build(model);
    expect(index.contains('missing.ts')).toBe(false);
  });

  // ── size ─────────────────────────────────────────────────────

  it('should return the number of indexed files', () => {
    index.build(model);
    expect(index.size()).toBe(4);
  });

  it('should throw SourceIndexNotBuiltError before build', () => {
    expect(() => index.size()).toThrow(SourceIndexNotBuiltError);
  });

  // ── clear ────────────────────────────────────────────────────

  it('should clear the index', () => {
    index.build(model);
    expect(index.size()).toBe(4);

    index.clear();
    expect(index.contains('package.json')).toBe(false);
    expect(() => index.size()).toThrow(SourceIndexNotBuiltError);
  });

  // ── rebuild ──────────────────────────────────────────────────

  it('should support rebuilding the index', () => {
    index.build(model);
    expect(index.size()).toBe(4);

    const result = index.build(model);
    expect(result.indexedFiles).toBe(4);
    expect(index.size()).toBe(4);
  });

  // ── project isolation ────────────────────────────────────────

  it('should isolate entries by project id', () => {
    const otherInfo: ProjectInfo = {
      projectId: 'proj-2',
      projectName: 'Other Project',
      rootPath: '/other',
      createdAt: 1000,
      scannedAt: 2000,
    };
    const otherModel = new ProjectModelBuilder().build(createScanResultWithInfo(otherInfo));

    index.build(model);
    const otherIndex = new SourceIndex();
    otherIndex.build(otherModel);

    expect(index.getFile('src/index.ts').projectId).toBe('proj-1');
    expect(otherIndex.getFile('src/index.ts').projectId).toBe('proj-2');
    expect(index.getById('proj-1:file:src/index.ts').path).toBe('src/index.ts');
    expect(otherIndex.getById('proj-2:file:src/index.ts').path).toBe('src/index.ts');
  });

  // ── interface conformance ────────────────────────────────────

  it('should conform to the ISourceIndex interface', () => {
    const sourceIndex: ISourceIndex = index;
    expect(sourceIndex.build).toBeTypeOf('function');
    expect(sourceIndex.getFile).toBeTypeOf('function');
    expect(sourceIndex.getById).toBeTypeOf('function');
    expect(sourceIndex.getAllFiles).toBeTypeOf('function');
    expect(sourceIndex.findFilesByExtension).toBeTypeOf('function');
    expect(sourceIndex.findByLanguage).toBeTypeOf('function');
    expect(sourceIndex.contains).toBeTypeOf('function');
    expect(sourceIndex.size).toBeTypeOf('function');
    expect(sourceIndex.clear).toBeTypeOf('function');
  });

  // ── events (definitions only) ────────────────────────────────

  it('should define source index event names', () => {
    expect(SourceIndexEvents.INDEX_BUILT).toBe('source.index.built');
    expect(SourceIndexEvents.INDEX_UPDATED).toBe('source.index.updated');
    expect(SourceIndexEvents.INDEX_CLEARED).toBe('source.index.cleared');
  });
});

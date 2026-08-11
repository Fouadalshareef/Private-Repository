import { describe, it, expect, beforeEach } from 'vitest';
import { CodingTaskPipeline } from '../../../src/agent/coding/CodingTaskPipeline.js';
import { CodingTaskStatus } from '../../../src/agent/coding/CodingTask.js';
import type { CodingTaskRequest } from '../../../src/agent/coding/CodingTask.js';
import type { IFileSystem } from '../../../src/filesystem/IFileSystem.js';
import type { FileInfo } from '../../../src/filesystem/FileInfo.js';
import type { DirectoryInfo } from '../../../src/filesystem/DirectoryInfo.js';
import type { ISourceIndex } from '../../../src/source/ISourceIndex.js';
import type { ISymbolStore } from '../../../src/symbol/ISymbolStore.js';
import type { SourceIndexEntry } from '../../../src/source/SourceIndexEntry.js';
import type { SourceSymbol } from '../../../src/source/SourceSymbol.js';
import type { IValidationEngine } from '../../../src/validation/IValidationEngine.js';
import type { ValidationResult, ValidationOptions, ValidationMessage } from '../../../src/validation/ValidationTypes.js';
import { ValidationSeverity } from '../../../src/validation/ValidationTypes.js';
import type { IDiffEngine } from '../../../src/diff/IDiffEngine.js';
import type { IPatchEngine } from '../../../src/patch/IPatchEngine.js';
import type { DiffResult, DiffEntry } from '../../../src/diff/DiffResult.js';
import type { PatchResult } from '../../../src/patch/PatchResult.js';
import type { LanguageType } from '../../../src/language/LanguageType.js';
import { MockAIProvider } from '../../../src/ai/MockAIProvider.js';
import { DiffEngine } from '../../../src/diff/DiffEngine.js';
import { PatchEngine } from '../../../src/patch/PatchEngine.js';

class FakeFileSystem implements IFileSystem {
  exists(path: string): boolean {
    return this.files.has(path) || this.dirs.has(path);
  }
  readFile(path: string): string {
    if (!this.files.has(path)) throw new Error(`File not found: ${path}`);
    return this.files.get(path)!;
  }
  writeFile(path: string, content: string): void {
    this.files.set(path, content);
  }
  delete(path: string): void {
    this.files.delete(path);
  }
  move(source: string, destination: string): void {
    this.files.set(destination, this.files.get(source)!);
    this.files.delete(source);
  }
  copy(source: string, destination: string): void {
    this.files.set(destination, this.files.get(source)!);
  }
  createDirectory(path: string): void {
    this.dirs.add(path);
  }
  deleteDirectory(path: string): void {
    this.dirs.delete(path);
  }
  list(_path: string): Array<FileInfo | DirectoryInfo> {
    void _path;
    return [];
  }
  stat(path: string): FileInfo | DirectoryInfo {
    const isDir = this.dirs.has(path);
    const name = path.split('/').pop() ?? path;
    if (isDir) {
      return {
        name,
        path,
        size: 0,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        isDirectory: true,
      } satisfies DirectoryInfo;
    }
    return {
      name,
      path,
      size: this.files.get(path)?.length ?? 0,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      isDirectory: false,
    } satisfies FileInfo;
  }
  constructor(public files = new Map<string, string>(), public dirs = new Set<string>()) {}
}

class FakeSourceIndex implements ISourceIndex {
  getAllFiles(): readonly SourceIndexEntry[] {
    return Array.from(this.entries.values());
  }
  getFile(_path: string): SourceIndexEntry {
    void _path;
    throw new Error('Not implemented');
  }
  getById(_id: string): SourceIndexEntry {
    void _id;
    throw new Error('Not implemented');
  }
  findFilesByExtension(_ext: string): readonly SourceIndexEntry[] {
    void _ext;
    return [];
  }
  findByLanguage(_lang: LanguageType): readonly SourceIndexEntry[] {
    void _lang;
    return [];
  }
  contains(_path: string): boolean {
    void _path;
    return false;
  }
  size(): number {
    return this.entries.size;
  }
  clear(): void {
    this.entries.clear();
  }
  build(_model: unknown): { indexedFiles: number; builtAt: number; entries: Map<string, SourceIndexEntry> } {
    void _model;
    return { indexedFiles: this.entries.size, builtAt: Date.now(), entries: this.entries };
  }
  constructor(private entries = new Map<string, SourceIndexEntry>()) {}
}

class FakeSymbolStore implements ISymbolStore {
  addSymbol(_symbol: SourceSymbol): void {
    void _symbol;
  }
  addSymbols(_symbols: SourceSymbol[]): void {
    void _symbols;
  }
  updateSymbolsForFile(_projectId: string, _filePath: string, _symbols: SourceSymbol[]): void {
    void _projectId;
    void _filePath;
    void _symbols;
  }
  getSymbol(_id: string): SourceSymbol | undefined {
    void _id;
    return undefined;
  }
  getSymbolsByName(name: string): SourceSymbol[] {
    return this.byName.get(name) ?? [];
  }
  getSymbolsByKind(_kind: string): SourceSymbol[] {
    void _kind;
    return [];
  }
  getSymbolsByFile(_projectId: string, _filePath: string): SourceSymbol[] {
    void _projectId;
    void _filePath;
    return [];
  }
  getSymbolsByProject(_projectId: string): SourceSymbol[] {
    void _projectId;
    return [];
  }
  getAllSymbols(): SourceSymbol[] {
    return [];
  }
  hasSymbol(_id: string): boolean {
    void _id;
    return false;
  }
  removeSymbolsForFile(_projectId: string, _filePath: string): void {
    void _projectId;
    void _filePath;
  }
  clearProject(_projectId: string): void {
    void _projectId;
  }
  clear(): void {
    this.byName.clear();
  }
  constructor(private byName = new Map<string, SourceSymbol[]>()) {}
}

function makeValidationResult(valid: boolean, messages: ValidationMessage[] = []): ValidationResult {
  return { valid, messages: Object.freeze(messages), durationMs: 0 };
}

function makeValidationEngine(overrides: Partial<IValidationEngine> = {}): IValidationEngine {
  return {
    validate: async (_options: ValidationOptions, _fileSystem: IFileSystem): Promise<ValidationResult> => {
      void _options;
      void _fileSystem;
      return makeValidationResult(true);
    },
    validateTypeScript: async (_projectPath: string, _fileSystem: IFileSystem): Promise<ValidationResult> => {
      void _projectPath;
      void _fileSystem;
      return makeValidationResult(true);
    },
    validateSyntax: (_content: string, _language: LanguageType, _filePath: string): ValidationResult => {
      void _content;
      void _language;
      void _filePath;
      return makeValidationResult(true);
    },
    validatePatchContent: (_baseContent: string, _newContent: string, _language: LanguageType, _filePath: string): ValidationResult => {
      void _baseContent;
      void _newContent;
      void _language;
      void _filePath;
      return makeValidationResult(true);
    },
    ...overrides,
  };
}

function makeDiffEngine(overrides: Partial<IDiffEngine> = {}): IDiffEngine {
  return {
    computeDiff: (oldContent: string, newContent: string): DiffResult =>
      new DiffEngine().computeDiff(oldContent, newContent),
    computeFileDiff: (oldPath: string, newPath: string, readFile: (path: string) => string): DiffResult =>
      new DiffEngine().computeFileDiff(oldPath, newPath, readFile),
    ...overrides,
  };
}

function makePatchEngine(overrides: Partial<IPatchEngine> = {}): IPatchEngine {
  return {
    canApply: (baseContent: string, patch: DiffResult): boolean =>
      new PatchEngine().canApply(baseContent, patch),
    applyPatch: (baseContent: string, patch: DiffResult): PatchResult =>
      new PatchEngine().applyPatch(baseContent, patch),
    validateEntry: (baseContent: string, entry: DiffEntry): boolean =>
      new PatchEngine().validateEntry(baseContent, entry),
    ...overrides,
  };
}

function makeRequest(overrides: Partial<CodingTaskRequest> = {}): CodingTaskRequest {
  return {
    prompt: 'fix src/app.ts',
    projectPath: '/',
    ...overrides,
  };
}

describe('CodingTaskPipeline', () => {
  let fs: FakeFileSystem;
  let mockProvider: MockAIProvider;

  beforeEach(() => {
    fs = new FakeFileSystem();
    mockProvider = new MockAIProvider({ defaultResponse: 'NO_CHANGES_NEEDED' });
  });

  describe('Agent Contract', () => {
    it('returns INVALID_REQUEST for an empty prompt', async () => {
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
      });
      const result = await pipeline.execute(makeRequest({ prompt: '   ' }));
      expect(result.status).toBe(CodingTaskStatus.INVALID_REQUEST);
      expect(result.modifiedFiles).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns INVALID_REQUEST for a missing prompt', async () => {
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
      });
      const result = await pipeline.execute({ prompt: '', projectPath: '/' });
      expect(result.status).toBe(CodingTaskStatus.INVALID_REQUEST);
    });

    it('returns CONTEXT_ERROR when no relevant files are found', async () => {
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
      });
      const result = await pipeline.execute(makeRequest({ prompt: 'do something unrelated' }));
      expect(result.status).toBe(CodingTaskStatus.CONTEXT_ERROR);
      expect(result.modifiedFiles).toHaveLength(0);
    });

    it('returns TOOL_ERROR when files cannot be read', async () => {
      // The path "exists" as a directory entry but readFile will throw.
      fs.dirs.add('src/app.ts');
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
      });
      const result = await pipeline.execute(makeRequest({ prompt: 'fix src/app.ts' }));
      expect(result.status).toBe(CodingTaskStatus.TOOL_ERROR);
      expect(result.errors.some((e) => e.includes('Could not read any relevant files'))).toBe(true);
    });

    it('returns a frozen result with durationMs', async () => {
      fs.files.set('src/app.ts', 'export const value = 1;');
      mockProvider = new MockAIProvider({
        defaultResponse: 'FILE: src/app.ts\n```\nexport const value = 2;\n```',
      });
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
        validationEngine: makeValidationEngine(),
      });
      const result = await pipeline.execute(makeRequest());
      expect(result.status).toBe(CodingTaskStatus.SUCCESS);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(Object.isFrozen(result.modifiedFiles)).toBe(true);
      expect(Object.isFrozen(result.errors)).toBe(true);
    });
  });

  describe('Context', () => {
    it('uses explicit targetFilePath when provided', async () => {
      fs.files.set('src/cart.ts', 'export const cart = [];');
      mockProvider = new MockAIProvider({
        defaultResponse: 'FILE: src/cart.ts\n```\nexport const cart = [1, 2, 3];\n```',
      });
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
        validationEngine: makeValidationEngine(),
      });
      const result = await pipeline.execute(makeRequest({ prompt: 'update cart', targetFilePath: 'src/cart.ts' }));
      expect(result.status).toBe(CodingTaskStatus.SUCCESS);
      expect(result.modifiedFiles).toContain('src/cart.ts');
    });

    it('builds context from SourceIndex', async () => {
      const sourceIndex = new FakeSourceIndex(
        new Map([['src/app.ts', {
          id: 'p1:src/app.ts',
          projectId: 'p1',
          path: 'src/app.ts',
          relativePath: 'src/app.ts',
          name: 'app.ts',
          extension: '.ts',
          languageHint: 'typescript' as LanguageType,
          size: 10,
          createdAt: 0,
          modifiedAt: 0,
          parsed: false,
        } as SourceIndexEntry]]),
      );
      fs.files.set('src/app.ts', 'export const value = 1;');
      mockProvider = new MockAIProvider({
        defaultResponse: 'FILE: src/app.ts\n```\nexport const value = 2;\n```',
      });
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
        sourceIndex,
        validationEngine: makeValidationEngine(),
      });
      const result = await pipeline.execute(makeRequest({ prompt: 'fix app' }));
      expect(result.status).toBe(CodingTaskStatus.SUCCESS);
      expect(result.modifiedFiles).toContain('src/app.ts');
    });

    it('builds context from SymbolStore', async () => {
      const symbolStore = new FakeSymbolStore(
        new Map([['calculateTotal', [{
          id: 's1',
          projectId: 'p1',
          name: 'calculateTotal',
          kind: 'function',
          filePath: 'src/cart.ts',
          line: 1,
        } as SourceSymbol]]]),
      );
      fs.files.set('src/cart.ts', 'export function calculateTotal() { return 0; }');
      mockProvider = new MockAIProvider({
        defaultResponse: 'FILE: src/cart.ts\n```\nexport function calculateTotal() { return 1; }\n```',
      });
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
        symbolStore,
        validationEngine: makeValidationEngine(),
      });
      const result = await pipeline.execute(makeRequest({ prompt: 'fix calculateTotal' }));
      expect(result.status).toBe(CodingTaskStatus.SUCCESS);
      expect(result.modifiedFiles).toContain('src/cart.ts');
    });

    it('limits context to maxContextFiles', async () => {
      const sourceIndex = new FakeSourceIndex(
        new Map([
          ['src/a.ts', {
            id: 'p1:src/a.ts', projectId: 'p1', path: 'src/a.ts', relativePath: 'src/a.ts',
            name: 'a.ts', extension: '.ts', languageHint: 'typescript' as LanguageType,
            size: 1, createdAt: 0, modifiedAt: 0, parsed: false,
          } as SourceIndexEntry],
          ['src/b.ts', {
            id: 'p1:src/b.ts', projectId: 'p1', path: 'src/b.ts', relativePath: 'src/b.ts',
            name: 'b.ts', extension: '.ts', languageHint: 'typescript' as LanguageType,
            size: 1, createdAt: 0, modifiedAt: 0, parsed: false,
          } as SourceIndexEntry],
          ['src/c.ts', {
            id: 'p1:src/c.ts', projectId: 'p1', path: 'src/c.ts', relativePath: 'src/c.ts',
            name: 'c.ts', extension: '.ts', languageHint: 'typescript' as LanguageType,
            size: 1, createdAt: 0, modifiedAt: 0, parsed: false,
          } as SourceIndexEntry],
        ]),
      );
      fs.files.set('src/a.ts', 'export const a = 1;');
      fs.files.set('src/b.ts', 'export const b = 2;');
      fs.files.set('src/c.ts', 'export const c = 3;');
      mockProvider = new MockAIProvider({
        defaultResponse: 'FILE: src/a.ts\n```\nexport const a = 10;\n```',
      });
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
        sourceIndex,
        maxContextFiles: 2,
        validationEngine: makeValidationEngine(),
      });
      const result = await pipeline.execute(makeRequest({ prompt: 'fix alpha', targetFilePath: 'src/a.ts' }));
      expect(result.status).toBe(CodingTaskStatus.SUCCESS);
      expect(result.modifiedFiles).toContain('src/a.ts');
    });
  });

  describe('AI', () => {
    it('returns AI_ERROR when provider fails', async () => {
      fs.files.set('src/app.ts', 'export const value = 1;');
      mockProvider.setAvailable(false);
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
      });
      const result = await pipeline.execute(makeRequest());
      expect(result.status).toBe(CodingTaskStatus.AI_ERROR);
    });

    it('returns AI_ERROR when provider returns malformed response', async () => {
      fs.files.set('src/app.ts', 'export const value = 1;');
      mockProvider = new MockAIProvider({ defaultResponse: 'not a valid proposal format' });
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
      });
      const result = await pipeline.execute(makeRequest());
      expect(result.status).toBe(CodingTaskStatus.AI_ERROR);
    });

    it('returns AI_ERROR when proposal has no valid changes', async () => {
      fs.files.set('src/app.ts', 'export const value = 1;');
      mockProvider = new MockAIProvider({ defaultResponse: 'NO_CHANGES_NEEDED' });
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
      });
      const result = await pipeline.execute(makeRequest());
      expect(result.status).toBe(CodingTaskStatus.AI_ERROR);
    });
  });

  describe('Change / Diff', () => {
    it('produces a diff with additions for a valid proposal', async () => {
      fs.files.set('src/app.ts', 'export const value = 1;');
      mockProvider = new MockAIProvider({
        defaultResponse: 'FILE: src/app.ts\n```\nexport const value = 1;\nexport const extra = 2;\n```',
      });
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
        validationEngine: makeValidationEngine(),
      });
      const result = await pipeline.execute(makeRequest());
      expect(result.status).toBe(CodingTaskStatus.SUCCESS);
      const diff = result.diffs.get('src/app.ts');
      expect(diff).toBeDefined();
      expect(diff!.addedLines).toBeGreaterThan(0);
      expect(diff!.isIdentical).toBe(false);
    });

    it('does not modify unintended files', async () => {
      fs.files.set('src/app.ts', 'export const value = 1;');
      fs.files.set('src/other.ts', 'export const other = 1;');
      mockProvider = new MockAIProvider({
        defaultResponse: 'FILE: src/app.ts\n```\nexport const value = 2;\n```',
      });
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
        validationEngine: makeValidationEngine(),
      });
      const result = await pipeline.execute(makeRequest());
      expect(result.status).toBe(CodingTaskStatus.SUCCESS);
      expect(result.modifiedFiles).toEqual(['src/app.ts']);
      expect(fs.readFile('src/other.ts')).toBe('export const other = 1;');
    });
  });

  describe('Patch', () => {
    it('returns PATCH_ERROR when patch cannot be applied', async () => {
      fs.files.set('src/app.ts', 'export const value = 1;');
      mockProvider = new MockAIProvider({
        defaultResponse: 'FILE: src/app.ts\n```\ncompletely different content\n```',
      });
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
        diffEngine: makeDiffEngine({
          computeDiff: (): DiffResult => ({
            isIdentical: false,
            entries: Object.freeze([]),
            addedLines: 1,
            removedLines: 0,
            modifiedLines: 0,
          }),
        }),
        patchEngine: makePatchEngine({
          applyPatch: (): PatchResult => ({
            success: false,
            error: 'base mismatch',
            appliedEntries: Object.freeze([]),
          }),
        }),
        validationEngine: makeValidationEngine(),
      });
      const result = await pipeline.execute(makeRequest());
      expect(result.status).toBe(CodingTaskStatus.PATCH_ERROR);
      expect(result.errors.some((e) => e.includes('base mismatch'))).toBe(true);
    });

    it('does not corrupt the file when patch is rejected', async () => {
      fs.files.set('src/app.ts', 'export const value = 1;');
      mockProvider = new MockAIProvider({
        defaultResponse: 'FILE: src/app.ts\n```\ncompletely different content\n```',
      });
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
        diffEngine: makeDiffEngine({
          computeDiff: (): DiffResult => ({
            isIdentical: false,
            entries: Object.freeze([]),
            addedLines: 1,
            removedLines: 0,
            modifiedLines: 0,
          }),
        }),
        patchEngine: makePatchEngine({
          applyPatch: (): PatchResult => ({
            success: false,
            error: 'base mismatch',
            appliedEntries: Object.freeze([]),
          }),
        }),
        validationEngine: makeValidationEngine(),
      });
      const result = await pipeline.execute(makeRequest());
      expect(result.status).toBe(CodingTaskStatus.PATCH_ERROR);
      expect(fs.readFile('src/app.ts')).toBe('export const value = 1;');
    });
  });

  describe('Validation', () => {
    it('returns VALIDATION_FAILED when proposal has syntax errors', async () => {
      fs.files.set('src/app.ts', 'export const value = 1;');
      mockProvider = new MockAIProvider({
        defaultResponse: 'FILE: src/app.ts\n```\ninvalid syntax here\n```',
      });
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
        validationEngine: makeValidationEngine({
          validateSyntax: (): ValidationResult =>
            makeValidationResult(false, [{ severity: ValidationSeverity.ERROR, message: 'syntax error' }]),
        }),
      });
      const result = await pipeline.execute(makeRequest());
      expect(result.status).toBe(CodingTaskStatus.VALIDATION_FAILED);
      expect(result.errors.some((e) => e.includes('syntax error'))).toBe(true);
    });

    it('returns VALIDATION_FAILED when final TypeScript validation fails', async () => {
      fs.files.set('src/app.ts', 'export const value = 1;');
      mockProvider = new MockAIProvider({
        defaultResponse: 'FILE: src/app.ts\n```\nexport const value = 2;\n```',
      });
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
        validationEngine: makeValidationEngine({
          validateTypeScript: async (): Promise<ValidationResult> =>
            makeValidationResult(false, [{ severity: ValidationSeverity.ERROR, message: 'TS error' }]),
        }),
      });
      const result = await pipeline.execute(makeRequest());
      expect(result.status).toBe(CodingTaskStatus.VALIDATION_FAILED);
      expect(result.errors.some((e) => e.includes('TS error'))).toBe(true);
    });
  });

  describe('Failure', () => {
    it('returns EXECUTION_FAILED for unexpected errors', async () => {
      fs.files.set('src/app.ts', 'export const value = 1;');
      mockProvider = new MockAIProvider({
        defaultResponse: 'FILE: src/app.ts\n```\nexport const value = 2;\n```',
      });
      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
        validationEngine: makeValidationEngine({
          validateSyntax: (): ValidationResult => {
            throw new Error('unexpected validation failure');
          },
        }),
      });
      const result = await pipeline.execute(makeRequest());
      expect(result.status).toBe(CodingTaskStatus.EXECUTION_FAILED);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Vertical Slice', () => {
    it('executes the full coding cycle: request -> read -> proposal -> diff -> patch -> validate -> result', async () => {
      // Create a temporary project with a Cart.ts file.
      fs.files.set('src/Cart.ts', [
        'export interface CartItem {',
        '  readonly id: string;',
        '  readonly price: number;',
        '}',
        '',
        'export class Cart {',
        '  private readonly items: CartItem[] = [];',
        '',
        '  public addItem(item: CartItem): void {',
        '    this.items.push(item);',
        '  }',
        '}',
      ].join('\n'));

      // The AI proposes adding a calculateTotal method.
      mockProvider = new MockAIProvider({
        defaultResponse: [
          'FILE: src/Cart.ts',
          '```typescript',
          'export interface CartItem {',
          '  readonly id: string;',
          '  readonly price: number;',
          '}',
          '',
          'export class Cart {',
          '  private readonly items: CartItem[] = [];',
          '',
          '  public addItem(item: CartItem): void {',
          '    this.items.push(item);',
          '  }',
          '',
          '  public calculateTotal(): number {',
          '    return this.items.reduce((sum, item) => sum + item.price, 0);',
          '  }',
          '}',
          '```',
        ].join('\n'),
      });

      const pipeline = new CodingTaskPipeline({
        fileSystem: fs,
        aiProvider: mockProvider,
        validationEngine: makeValidationEngine(),
      });

      const request: CodingTaskRequest = {
        prompt: 'أضف دالة calculateTotal إلى ملف Cart.ts',
        projectPath: '/',
        targetFilePath: 'src/Cart.ts',
      };

      const result = await pipeline.execute(request);

      // Assert the full cycle succeeded.
      expect(result.status).toBe(CodingTaskStatus.SUCCESS);
      expect(result.modifiedFiles).toContain('src/Cart.ts');
      expect(result.proposedChanges).toHaveLength(1);
      expect(result.proposedChanges[0].filePath).toBe('src/Cart.ts');
      expect(result.proposedChanges[0].newContent).toContain('calculateTotal');

      // Assert the diff was computed.
      const diff = result.diffs.get('src/Cart.ts');
      expect(diff).toBeDefined();
      expect(diff!.addedLines).toBeGreaterThan(0);
      expect(diff!.isIdentical).toBe(false);

      // Assert the file was actually modified.
      const modifiedContent = fs.readFile('src/Cart.ts');
      expect(modifiedContent).toContain('calculateTotal');
      expect(modifiedContent).toContain('this.items.reduce');
    });
  });
});
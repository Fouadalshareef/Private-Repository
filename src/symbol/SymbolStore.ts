import type { ISymbolStore } from './ISymbolStore.js';
import type { SourceSymbol } from '../source/SourceSymbol.js';
import { DuplicateSymbolError } from './SymbolStoreError.js';

/**
 * An in-memory symbol store that indexes code symbols by project,
 * file, name, kind, and stable identity.
 *
 * Symbol identities are deterministic and derived from:
 * - projectId
 * - file path
 * - symbol name
 * - symbol kind
 * - line number
 *
 * This guarantees that the same code element always yields the same
 * identity regardless of traversal or execution order.
 */
export class SymbolStore implements ISymbolStore {
  private readonly byId: Map<string, SourceSymbol>;
  private readonly byName: Map<string, SourceSymbol[]>;
  private readonly byKind: Map<string, SourceSymbol[]>;
  private readonly byFile: Map<string, SourceSymbol[]>;
  private readonly byProject: Map<string, SourceSymbol[]>;

  constructor() {
    this.byId = new Map();
    this.byName = new Map();
    this.byKind = new Map();
    this.byFile = new Map();
    this.byProject = new Map();
  }

  public addSymbol(symbol: SourceSymbol): void {
    if (this.byId.has(symbol.id)) {
      throw new DuplicateSymbolError(symbol.id);
    }

    this.byId.set(symbol.id, symbol);
    this.indexByName(symbol);
    this.indexByKind(symbol);
    this.indexByFile(symbol);
    this.indexByProject(symbol);
  }

  public addSymbols(symbols: SourceSymbol[]): void {
    for (const symbol of symbols) {
      this.addSymbol(symbol);
    }
  }

  public updateSymbolsForFile(projectId: string, filePath: string, symbols: SourceSymbol[]): void {
    this.removeSymbolsForFile(projectId, filePath);
    this.addSymbols(symbols);
  }

  public getSymbol(id: string): SourceSymbol | undefined {
    return this.byId.get(id);
  }

  public getSymbolsByName(name: string): SourceSymbol[] {
    return this.byName.get(name) ?? [];
  }

  public getSymbolsByKind(kind: string): SourceSymbol[] {
    return this.byKind.get(kind) ?? [];
  }

  public getSymbolsByFile(projectId: string, filePath: string): SourceSymbol[] {
    return this.byFile.get(this.fileKey(projectId, filePath)) ?? [];
  }

  public getSymbolsByProject(projectId: string): SourceSymbol[] {
    return this.byProject.get(projectId) ?? [];
  }

  public getAllSymbols(): SourceSymbol[] {
    return Array.from(this.byId.values());
  }

  public hasSymbol(id: string): boolean {
    return this.byId.has(id);
  }

  public removeSymbolsForFile(projectId: string, filePath: string): void {
    const key = this.fileKey(projectId, filePath);
    const symbols = this.byFile.get(key) ?? [];
    for (const symbol of symbols) {
      this.byId.delete(symbol.id);
      this.removeFromIndex(this.byName, symbol.name, symbol);
      this.removeFromIndex(this.byKind, symbol.kind, symbol);
      this.removeFromIndex(this.byProject, symbol.projectId, symbol);
    }
    this.byFile.delete(key);
  }

  public clearProject(projectId: string): void {
    const symbols = this.byProject.get(projectId) ?? [];
    for (const symbol of symbols) {
      this.byId.delete(symbol.id);
      this.removeFromIndex(this.byName, symbol.name, symbol);
      this.removeFromIndex(this.byKind, symbol.kind, symbol);
      this.removeFromIndex(this.byFile, this.fileKey(symbol.projectId, symbol.filePath), symbol);
    }
    this.byProject.delete(projectId);
  }

  public clear(): void {
    this.byId.clear();
    this.byName.clear();
    this.byKind.clear();
    this.byFile.clear();
    this.byProject.clear();
  }

  private indexByName(symbol: SourceSymbol): void {
    const list = this.byName.get(symbol.name) ?? [];
    list.push(symbol);
    this.byName.set(symbol.name, list);
  }

  private indexByKind(symbol: SourceSymbol): void {
    const list = this.byKind.get(symbol.kind) ?? [];
    list.push(symbol);
    this.byKind.set(symbol.kind, list);
  }

  private indexByFile(symbol: SourceSymbol): void {
    const key = this.fileKey(symbol.projectId, symbol.filePath);
    const list = this.byFile.get(key) ?? [];
    list.push(symbol);
    this.byFile.set(key, list);
  }

  private indexByProject(symbol: SourceSymbol): void {
    const list = this.byProject.get(symbol.projectId) ?? [];
    list.push(symbol);
    this.byProject.set(symbol.projectId, list);
  }

  private removeFromIndex<K extends string>(
    map: Map<K, SourceSymbol[]>,
    key: K,
    symbol: SourceSymbol,
  ): void {
    const list = map.get(key);
    if (!list) {
      return;
    }
    const filtered = list.filter((s) => s.id !== symbol.id);
    if (filtered.length === 0) {
      map.delete(key);
    } else {
      map.set(key, filtered);
    }
  }

  private fileKey(projectId: string, filePath: string): string {
    return `${projectId}:${filePath}`;
  }
}

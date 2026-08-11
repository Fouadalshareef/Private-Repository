import { describe, it, expect } from 'vitest';
import { SymbolStore } from '../../src/symbol/SymbolStore.js';
import type { SourceSymbol } from '../../src/source/SourceSymbol.js';

function makeSymbol(overrides: Partial<SourceSymbol> = {}): SourceSymbol {
  return {
    id: 'proj-1:symbol:src/foo.ts:Foo:class:1',
    projectId: 'proj-1',
    name: 'Foo',
    kind: 'class',
    filePath: 'src/foo.ts',
    line: 1,
    ...overrides,
  };
}

describe('SymbolStore', () => {
  it('constructs empty', () => {
    const store = new SymbolStore();
    expect(store.getAllSymbols()).toEqual([]);
  });

  it('adds and retrieves a symbol', () => {
    const store = new SymbolStore();
    const symbol = makeSymbol();
    store.addSymbol(symbol);
    expect(store.getSymbol(symbol.id)).toBe(symbol);
    expect(store.hasSymbol(symbol.id)).toBe(true);
  });

  it('throws on duplicate identity', () => {
    const store = new SymbolStore();
    const symbol = makeSymbol();
    store.addSymbol(symbol);
    expect(() => store.addSymbol(symbol)).toThrow();
  });

  it('adds multiple symbols', () => {
    const store = new SymbolStore();
    const symbols = [makeSymbol(), makeSymbol({ id: 'proj-1:symbol:src/bar.ts:Bar:class:1', name: 'Bar', filePath: 'src/bar.ts' })];
    store.addSymbols(symbols);
    expect(store.getAllSymbols()).toHaveLength(2);
  });

  it('updates symbols for a file', () => {
    const store = new SymbolStore();
    const oldSymbol = makeSymbol();
    store.addSymbol(oldSymbol);
    const newSymbol = makeSymbol({ id: 'proj-1:symbol:src/foo.ts:Foo:class:2', line: 2 });
    store.updateSymbolsForFile('proj-1', 'src/foo.ts', [newSymbol]);
    expect(store.getAllSymbols()).toHaveLength(1);
    expect(store.getSymbol(newSymbol.id)?.line).toBe(2);
  });

  it('searches by name', () => {
    const store = new SymbolStore();
    store.addSymbol(makeSymbol());
    store.addSymbol(makeSymbol({ id: 'proj-1:symbol:src/bar.ts:Bar:class:1', name: 'Bar', filePath: 'src/bar.ts' }));
    expect(store.getSymbolsByName('Foo')).toHaveLength(1);
    expect(store.getSymbolsByName('Bar')).toHaveLength(1);
    expect(store.getSymbolsByName('Baz')).toHaveLength(0);
  });

  it('searches by kind', () => {
    const store = new SymbolStore();
    store.addSymbol(makeSymbol({ kind: 'class' }));
    store.addSymbol(makeSymbol({ id: 'proj-1:symbol:src/foo.ts:foo:function:2', name: 'foo', kind: 'function' }));
    expect(store.getSymbolsByKind('class')).toHaveLength(1);
    expect(store.getSymbolsByKind('function')).toHaveLength(1);
  });

  it('searches by file', () => {
    const store = new SymbolStore();
    store.addSymbol(makeSymbol());
    store.addSymbol(makeSymbol({ id: 'proj-1:symbol:src/bar.ts:Bar:class:1', name: 'Bar', filePath: 'src/bar.ts' }));
    expect(store.getSymbolsByFile('proj-1', 'src/foo.ts')).toHaveLength(1);
    expect(store.getSymbolsByFile('proj-1', 'src/bar.ts')).toHaveLength(1);
    expect(store.getSymbolsByFile('proj-1', 'src/baz.ts')).toHaveLength(0);
  });

  it('searches by project', () => {
    const store = new SymbolStore();
    store.addSymbol(makeSymbol());
    store.addSymbol(makeSymbol({ id: 'proj-2:symbol:src/foo.ts:Foo:class:1', projectId: 'proj-2', filePath: 'src/foo.ts' }));
    expect(store.getSymbolsByProject('proj-1')).toHaveLength(1);
    expect(store.getSymbolsByProject('proj-2')).toHaveLength(1);
  });

  it('isolates symbols by project', () => {
    const store = new SymbolStore();
    const symbol1 = makeSymbol({ id: 'proj-1:symbol:src/foo.ts:Foo:class:1' });
    const symbol2 = makeSymbol({ id: 'proj-2:symbol:src/foo.ts:Foo:class:1', projectId: 'proj-2' });
    store.addSymbol(symbol1);
    store.addSymbol(symbol2);
    expect(store.getAllSymbols()).toHaveLength(2);
    expect(store.getSymbolsByProject('proj-1')).toHaveLength(1);
  });

  it('removes symbols for a file', () => {
    const store = new SymbolStore();
    store.addSymbol(makeSymbol());
    store.addSymbol(makeSymbol({ id: 'proj-1:symbol:src/foo.ts:Bar:function:2', name: 'Bar', kind: 'function' }));
    store.removeSymbolsForFile('proj-1', 'src/foo.ts');
    expect(store.getAllSymbols()).toHaveLength(0);
  });

  it('clears a project', () => {
    const store = new SymbolStore();
    store.addSymbol(makeSymbol());
    store.addSymbol(makeSymbol({ id: 'proj-2:symbol:src/foo.ts:Foo:class:1', projectId: 'proj-2', filePath: 'src/foo.ts' }));
    store.clearProject('proj-1');
    expect(store.getAllSymbols()).toHaveLength(1);
    expect(store.getSymbolsByProject('proj-1')).toHaveLength(0);
  });

  it('clears all symbols', () => {
    const store = new SymbolStore();
    store.addSymbol(makeSymbol());
    store.addSymbol(makeSymbol({ id: 'proj-2:symbol:src/foo.ts:Foo:class:1', projectId: 'proj-2', filePath: 'src/foo.ts' }));
    store.clear();
    expect(store.getAllSymbols()).toHaveLength(0);
  });
});

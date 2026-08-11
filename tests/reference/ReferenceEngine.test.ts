import { describe, it, expect } from 'vitest';
import { ReferenceEngine } from '../../src/reference/ReferenceEngine.js';
import type { SourceSymbol } from '../../src/source/SourceSymbol.js';
import { ReferenceKind } from '../../src/reference/ReferenceTypes.js';

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

describe('ReferenceEngine', () => {
  it('builds a reference map with definitions', () => {
    const engine = new ReferenceEngine();
    const symbols = [makeSymbol()];
    const map = engine.buildReferenceMap(symbols, new Map());

    expect(map.references).toHaveLength(1);
    expect(map.references[0].kind).toBe(ReferenceKind.DEFINITION);
    expect(map.references[0].fromName).toBe('Foo');
  });

  it('includes import relationships', () => {
    const engine = new ReferenceEngine();
    const symbols: SourceSymbol[] = [];
    const fileImports = new Map([['src/foo.ts', ['./bar']]]);
    const map = engine.buildReferenceMap(symbols, fileImports);

    expect(map.references).toHaveLength(1);
    expect(map.references[0].kind).toBe(ReferenceKind.IMPORT);
    expect(map.fileImports.get('src/foo.ts')).toEqual(['./bar']);
  });

  it('finds references from a symbol', () => {
    const engine = new ReferenceEngine();
    const symbol = makeSymbol({ references: ['util'] });
    const map = engine.buildReferenceMap([symbol], new Map());

    const refs = engine.findReferencesFromSymbol(map, symbol.id, ReferenceKind.REFERENCE);
    expect(refs).toHaveLength(1);
    expect(refs[0].toName).toBe('util');
  });

  it('finds references to a symbol by name', () => {
    const engine = new ReferenceEngine();
    const symbol = makeSymbol({ name: 'Foo' });
    const map = engine.buildReferenceMap([symbol], new Map());

    const refs = engine.findReferencesToSymbol(map, 'Foo');
    expect(refs.length).toBeGreaterThanOrEqual(1);
  });

  it('returns file imports', () => {
    const engine = new ReferenceEngine();
    const fileImports = new Map([['src/foo.ts', ['./bar', './baz']]]);
    const map = engine.buildReferenceMap([], fileImports);

    expect(engine.getFileImports(map, 'src/foo.ts')).toEqual(['./bar', './baz']);
    expect(engine.getFileImports(map, 'src/missing.ts')).toEqual([]);
  });

  it('returns symbol references', () => {
    const engine = new ReferenceEngine();
    const symbol = makeSymbol({ references: ['util', 'helper'] });
    const map = engine.buildReferenceMap([symbol], new Map());

    expect(engine.getSymbolReferences(map, symbol.id)).toEqual(['util', 'helper']);
    expect(engine.getSymbolReferences(map, 'missing')).toEqual([]);
  });

  it('supports project isolation', () => {
    const engine = new ReferenceEngine();
    const symbol1 = makeSymbol({ id: 'proj-1:symbol:src/foo.ts:Foo:class:1', projectId: 'proj-1' });
    const symbol2 = makeSymbol({ id: 'proj-2:symbol:src/foo.ts:Foo:class:1', projectId: 'proj-2', filePath: 'src/foo.ts' });
    const map = engine.buildReferenceMap([symbol1, symbol2], new Map());

    expect(map.references).toHaveLength(2);
  });
});

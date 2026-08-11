import type { IReferenceEngine } from './IReferenceEngine.js';
import type { SourceSymbol } from '../source/SourceSymbol.js';
import type { ReferenceMap, Reference } from './ReferenceTypes.js';
import { ReferenceKind } from './ReferenceTypes.js';

/**
 * Reference Engine implementation.
 *
 * Builds relationships between code entities from parsed symbols and
 * import data. For regex-based parsers, symbol references are
 * approximate name-based matches, not full semantic resolution.
 */
export class ReferenceEngine implements IReferenceEngine {
  public buildReferenceMap(symbols: SourceSymbol[], fileImports: Map<string, string[]>): ReferenceMap {
    const references: Reference[] = [];
    const symbolRefs = new Map<string, string[]>();

    // Build definition references for each symbol
    for (const symbol of symbols) {
      references.push({
        kind: ReferenceKind.DEFINITION,
        fromId: symbol.id,
        fromName: symbol.name,
        toId: symbol.id,
        toName: symbol.name,
        filePath: symbol.filePath,
        line: symbol.line,
      });

      if (symbol.references && symbol.references.length > 0) {
        symbolRefs.set(symbol.id, [...symbol.references]);
        for (const refName of symbol.references) {
          references.push({
            kind: ReferenceKind.REFERENCE,
            fromId: symbol.id,
            fromName: symbol.name,
            toName: refName,
            filePath: symbol.filePath,
            line: symbol.line,
          });
        }
      }
    }

    // Build import relationships
    for (const [filePath, imports] of fileImports) {
      for (const imported of imports) {
        references.push({
          kind: ReferenceKind.IMPORT,
          fromId: filePath,
          fromName: filePath,
          toName: imported,
          filePath,
          line: 0,
        });
      }
    }

    return {
      references: Object.freeze(references),
      fileImports: Object.freeze(new Map(fileImports)),
      symbolReferences: Object.freeze(new Map(symbolRefs)),
    };
  }

  public findReferencesFromSymbol(map: ReferenceMap, symbolId: string, kind: ReferenceKind): Reference[] {
    return map.references.filter(
      (r) => r.fromId === symbolId && r.kind === kind,
    );
  }

  public findReferencesToSymbol(map: ReferenceMap, symbolName: string): Reference[] {
    return map.references.filter(
      (r) => r.toName === symbolName || r.fromName === symbolName,
    );
  }

  public getFileImports(map: ReferenceMap, filePath: string): readonly string[] {
    return map.fileImports.get(filePath) ?? [];
  }

  public getSymbolReferences(map: ReferenceMap, symbolId: string): readonly string[] {
    return map.symbolReferences.get(symbolId) ?? [];
  }
}

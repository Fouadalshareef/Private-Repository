import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LanguageService } from '../src/language/LanguageService.js';
import { LanguageRegistry } from '../src/language/LanguageRegistry.js';
import { SourceParser } from '../src/language/SourceParser.js';
import { LanguageType } from '../src/language/LanguageType.js';
import {
  LanguageError,
  UnsupportedLanguageError,
  ParseError,
} from '../src/language/LanguageError.js';
import { LanguageEvents } from '../src/language/LanguageEvents.js';
import type { ILanguageService } from '../src/language/ILanguageService.js';


describe('LanguageService', () => {
  let service: LanguageService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T00:00:00.000Z'));
    service = new LanguageService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── language detection ────────────────────────────────────────

  it('should detect TypeScript by extension', () => {
    expect(service.detectLanguage('file.ts')).toBe(LanguageType.TYPESCRIPT);
    expect(service.detectLanguage('file.tsx')).toBe(LanguageType.TYPESCRIPT);
  });

  it('should detect JavaScript by extension', () => {
    expect(service.detectLanguage('file.js')).toBe(LanguageType.JAVASCRIPT);
    expect(service.detectLanguage('file.jsx')).toBe(LanguageType.JAVASCRIPT);
    expect(service.detectLanguage('file.mjs')).toBe(LanguageType.JAVASCRIPT);
    expect(service.detectLanguage('file.cjs')).toBe(LanguageType.JAVASCRIPT);
  });

  it('should detect Python by extension', () => {
    expect(service.detectLanguage('file.py')).toBe(LanguageType.PYTHON);
  });

  it('should detect HTML by extension', () => {
    expect(service.detectLanguage('file.html')).toBe(LanguageType.HTML);
    expect(service.detectLanguage('file.htm')).toBe(LanguageType.HTML);
  });

  it('should detect CSS by extension', () => {
    expect(service.detectLanguage('file.css')).toBe(LanguageType.CSS);
  });

  it('should detect JSON by extension', () => {
    expect(service.detectLanguage('file.json')).toBe(LanguageType.JSON);
  });

  it('should return UNKNOWN for unsupported extensions', () => {
    expect(service.detectLanguage('file.unknown')).toBe(LanguageType.UNKNOWN);
    expect(service.detectLanguage('file')).toBe(LanguageType.UNKNOWN);
  });

  // ── symbol parsing ────────────────────────────────────────────

  it('should parse classes from TypeScript', () => {
    const content = `
      export class MyClass {}
      class AnotherClass {}
      export default class DefaultClass {}
    `;
    const symbols = service.parseSymbols(content, LanguageType.TYPESCRIPT, 'test.ts', 'proj-1');
    const classes = symbols.filter((s) => s.kind === 'class');
    expect(classes.map((s) => s.name)).toEqual(expect.arrayContaining(['MyClass', 'AnotherClass', 'DefaultClass']));
  });

  it('should parse interfaces from TypeScript', () => {
    const content = `
      export interface MyInterface {}
      interface AnotherInterface {}
    `;
    const symbols = service.parseSymbols(content, LanguageType.TYPESCRIPT, 'test.ts', 'proj-1');
    const interfaces = symbols.filter((s) => s.kind === 'interface');
    expect(interfaces.map((s) => s.name)).toEqual(expect.arrayContaining(['MyInterface', 'AnotherInterface']));
  });

  it('should parse functions from TypeScript', () => {
    const content = `
      export function myFunction() {}
      function anotherFunction() {}
      async function asyncFunction() {}
    `;
    const symbols = service.parseSymbols(content, LanguageType.TYPESCRIPT, 'test.ts', 'proj-1');
    const functions = symbols.filter((s) => s.kind === 'function');
    expect(functions.map((s) => s.name)).toEqual(expect.arrayContaining(['myFunction', 'anotherFunction', 'asyncFunction']));
  });

  it('should parse arrow functions from TypeScript', () => {
    const content = `
      const myArrow = () => {};
      export const anotherArrow = async () => {};
    `;
    const symbols = service.parseSymbols(content, LanguageType.TYPESCRIPT, 'test.ts', 'proj-1');
    const functions = symbols.filter((s) => s.kind === 'function');
    expect(functions.map((s) => s.name)).toEqual(expect.arrayContaining(['myArrow', 'anotherArrow']));
  });

  it('should parse enums from TypeScript', () => {
    const content = `
      enum MyEnum {}
      const enum AnotherEnum {}
    `;
    const symbols = service.parseSymbols(content, LanguageType.TYPESCRIPT, 'test.ts', 'proj-1');
    const enums = symbols.filter((s) => s.kind === 'enum');
    expect(enums.map((s) => s.name)).toEqual(expect.arrayContaining(['MyEnum', 'AnotherEnum']));
  });

  it('should parse type aliases from TypeScript', () => {
    const content = `
      type MyType = string;
      export type AnotherType = number;
    `;
    const symbols = service.parseSymbols(content, LanguageType.TYPESCRIPT, 'test.ts', 'proj-1');
    const types = symbols.filter((s) => s.kind === 'type');
    expect(types.map((s) => s.name)).toEqual(expect.arrayContaining(['MyType', 'AnotherType']));
  });

  it('should parse variables from TypeScript', () => {
    const content = `
      const myVar = 1;
      export let anotherVar = 2;
      var oldVar = 3;
    `;
    const symbols = service.parseSymbols(content, LanguageType.TYPESCRIPT, 'test.ts', 'proj-1');
    const variables = symbols.filter((s) => s.kind === 'variable');
    expect(variables.map((s) => s.name)).toEqual(expect.arrayContaining(['myVar', 'anotherVar', 'oldVar']));
  });

  it('should parse classes from Python', () => {
    const content = `
      class MyClass:
          pass
      class AnotherClass:
          pass
    `;
    const symbols = service.parseSymbols(content, LanguageType.PYTHON, 'test.py', 'proj-1');
    const classes = symbols.filter((s) => s.kind === 'class');
    expect(classes.map((s) => s.name)).toEqual(expect.arrayContaining(['MyClass', 'AnotherClass']));
  });

  it('should parse functions from Python', () => {
    const content = `
      def my_function():
          pass
      async def async_function():
          pass
    `;
    const symbols = service.parseSymbols(content, LanguageType.PYTHON, 'test.py', 'proj-1');
    const functions = symbols.filter((s) => s.kind === 'function');
    expect(functions.map((s) => s.name)).toEqual(expect.arrayContaining(['my_function', 'async_function']));
  });

  it('should parse top-level keys from JSON', () => {
    const content = JSON.stringify({ name: 'test', version: '1.0.0' });
    const symbols = service.parseSymbols(content, LanguageType.JSON, 'config.json', 'proj-1');
    expect(symbols.map((s) => s.name)).toEqual(expect.arrayContaining(['name', 'version']));
  });

  it('should throw ParseError for invalid JSON', () => {
    expect(() => service.parseSymbols('{invalid}', LanguageType.JSON, 'config.json', 'proj-1')).toThrow(ParseError);
  });

  it('should return empty for HTML and CSS', () => {
    expect(service.parseSymbols('<div></div>', LanguageType.HTML, 'test.html', 'proj-1')).toEqual([]);
    expect(service.parseSymbols('body { }', LanguageType.CSS, 'test.css', 'proj-1')).toEqual([]);
  });

  it('should return empty for unknown language', () => {
    expect(service.parseSymbols('content', LanguageType.UNKNOWN, 'test.unknown', 'proj-1')).toEqual([]);
  });

  it('should include file path and line in symbols', () => {
    const content = `
      class MyClass {}
    `;
    const symbols = service.parseSymbols(content, LanguageType.TYPESCRIPT, 'src/test.ts', 'proj-1');
    expect(symbols[0].filePath).toBe('src/test.ts');
    expect(symbols[0].line).toBe(2);
  });

  it('should assign deterministic symbol ids', () => {
    const content = `class Foo {}`;
    const symbols = service.parseSymbols(content, LanguageType.TYPESCRIPT, 'src/foo.ts', 'proj-1');
    expect(symbols[0].id).toBe('proj-1:symbol:src/foo.ts:Foo:class:1');
  });

  // ── import extraction ────────────────────────────────────────

  it('should extract imports from TypeScript', () => {
    const content = `
      import { foo } from './foo';
      import bar from './bar';
      import('./baz');
      const x = require('./x');
    `;
    const imports = service.extractImports(content, LanguageType.TYPESCRIPT);
    expect(imports).toEqual(expect.arrayContaining(["./foo", "./bar", "./baz", "./x"]));
  });

  it('should extract imports from Python', () => {
    const content = `
      import os
      from sys import path
    `;
    const imports = service.extractImports(content, LanguageType.PYTHON);
    expect(imports).toEqual(expect.arrayContaining(['os', 'sys']));
  });

  it('should return empty imports for unsupported languages', () => {
    expect(service.extractImports('content', LanguageType.JSON)).toEqual([]);
    expect(service.extractImports('content', LanguageType.HTML)).toEqual([]);
  });

  // ── export extraction ────────────────────────────────────────

  it('should extract exports from TypeScript', () => {
    const content = `
      export class MyClass {}
      export function myFunction() {}
      export const myConst = 1;
      export interface MyInterface {}
      export type MyType = string;
      export enum MyEnum {}
    `;
    const exports = service.extractExports(content, LanguageType.TYPESCRIPT);
    expect(exports).toEqual(expect.arrayContaining(['MyClass', 'myFunction', 'myConst', 'MyInterface', 'MyType', 'MyEnum']));
  });

  it('should extract exports from Python', () => {
    const content = `__all__ = ['foo', 'bar']`;
    const exports = service.extractExports(content, LanguageType.PYTHON);
    expect(exports).toEqual(['foo', 'bar']);
  });

  it('should return empty exports for unsupported languages', () => {
    expect(service.extractExports('content', LanguageType.JSON)).toEqual([]);
    expect(service.extractExports('content', LanguageType.HTML)).toEqual([]);
  });

  // ── LanguageRegistry ─────────────────────────────────────────

  it('should allow registering custom extensions', () => {
    const registry = new LanguageRegistry();
    registry.register('.vue', LanguageType.TYPESCRIPT);
    expect(registry.getLanguage('.vue')).toBe(LanguageType.TYPESCRIPT);
    expect(registry.has('.vue')).toBe(true);
  });

  it('should return UNKNOWN for unregistered extensions', () => {
    const registry = new LanguageRegistry();
    expect(registry.getLanguage('.xyz')).toBe(LanguageType.UNKNOWN);
    expect(registry.has('.xyz')).toBe(false);
  });

  it('should be case-insensitive for extensions', () => {
    const registry = new LanguageRegistry();
    expect(registry.getLanguage('.TS')).toBe(LanguageType.TYPESCRIPT);
    expect(registry.getLanguage('.JSON')).toBe(LanguageType.JSON);
  });

  // ── SourceParser ─────────────────────────────────────────────

  it('should be accessible via the service', () => {
    expect(service.getParser()).toBeInstanceOf(SourceParser);
  });

  it('should expose the language registry via the service', () => {
    expect(service.getLanguageRegistry()).toBeInstanceOf(LanguageRegistry);
  });

  // ── interface conformance ────────────────────────────────────

  it('should conform to the ILanguageService interface', () => {
    const languageService: ILanguageService = service;
    expect(languageService.detectLanguage).toBeTypeOf('function');
    expect(languageService.parseSymbols).toBeTypeOf('function');
    expect(languageService.extractImports).toBeTypeOf('function');
    expect(languageService.extractExports).toBeTypeOf('function');
    expect(languageService.enrichSourceIndex).toBeTypeOf('function');
  });

  // ── errors ───────────────────────────────────────────────────

  it('should have LanguageError as base class', () => {
    const error = new LanguageError('test');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('LanguageError');
  });

  it('should have UnsupportedLanguageError as subclass', () => {
    const error = new UnsupportedLanguageError('.xyz');
    expect(error).toBeInstanceOf(LanguageError);
    expect(error.name).toBe('UnsupportedLanguageError');
  });

  it('should have ParseError as subclass', () => {
    const error = new ParseError('bad parse');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ParseError');
  });

  // ── events (definitions only) ────────────────────────────────

  it('should define language event names', () => {
    expect(LanguageEvents.FILE_PARSED).toBe('language.file.parsed');
    expect(LanguageEvents.SYMBOLS_EXTRACTED).toBe('language.symbols.extracted');
    expect(LanguageEvents.IMPORTS_EXTRACTED).toBe('language.imports.extracted');
    expect(LanguageEvents.EXPORTS_EXTRACTED).toBe('language.exports.extracted');
    expect(LanguageEvents.PARSE_FAILED).toBe('language.parse.failed');
  });
});

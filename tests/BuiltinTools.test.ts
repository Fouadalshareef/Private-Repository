import { describe, it, expect } from 'vitest';
import { VirtualFileSystem } from '../src/filesystem/VirtualFileSystem.js';
import { ReadFileTool } from '../src/tools/builtin/FileSystemTools.js';
import { WriteFileTool } from '../src/tools/builtin/FileSystemTools.js';
import { DeleteFileTool } from '../src/tools/builtin/FileSystemTools.js';
import { ListDirectoryTool } from '../src/tools/builtin/FileSystemTools.js';
import { SearchWorkspaceTool } from '../src/tools/builtin/SearchWorkspaceTool.js';
import { ExecuteCommandTool, SimulatedTerminal } from '../src/tools/builtin/ExecuteCommandTool.js';
import { FileNotFoundError, FileSystemOperationError } from '../src/filesystem/FileSystemError.js';
import type { ITool } from '../src/tools/ITool.js';

function createFileSystem(): VirtualFileSystem {
  const fs = new VirtualFileSystem();
  fs.writeFile('/hello.txt', 'Hello, World!');
  fs.createDirectory('/src');
  fs.writeFile('/src/index.ts', 'export const VERSION = "1.0.0";\n');
  fs.writeFile('/src/utils.ts', 'export function add(a: number, b: number) { return a + b; }\n');
  fs.createDirectory('/src/lib');
  fs.writeFile('/src/lib/helper.ts', 'export const helper = true;\n');
  return fs;
}

describe('BuiltinTools', () => {
  describe('ReadFileTool', () => {
    it('should read an existing file', () => {
      const fs = createFileSystem();
      const tool = new ReadFileTool(fs);
      const result = tool.handler({ path: '/hello.txt' });
      expect(result).toBe('Hello, World!');
    });

    it('should throw FileNotFoundError for missing files', () => {
      const fs = createFileSystem();
      const tool = new ReadFileTool(fs);
      expect(() => tool.handler({ path: '/missing.txt' })).toThrow(FileNotFoundError);
    });

    it('should reject path traversal attempts', () => {
      const fs = createFileSystem();
      const tool = new ReadFileTool(fs);
      expect(() => tool.handler({ path: '/../etc/passwd' })).toThrow(FileSystemOperationError);
      expect(() => tool.handler({ path: '/hello.txt/../../secret' })).toThrow(FileSystemOperationError);
    });

    it('should expose the correct ITool interface', () => {
      const fs = createFileSystem();
      const tool = new ReadFileTool(fs);
      expect(tool.name).toBe('fs.read_file');
      expect(tool.description).toBeTruthy();
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.required).toContain('path');
    });
  });

  describe('WriteFileTool', () => {
    it('should write a new file', () => {
      const fs = createFileSystem();
      const tool = new WriteFileTool(fs);
      const result = tool.handler({ path: '/new.txt', content: 'new content' });
      expect(result).toBe('Successfully wrote 11 bytes to "/new.txt".');
      expect(fs.readFile('/new.txt')).toBe('new content');
    });

    it('should overwrite an existing file', () => {
      const fs = createFileSystem();
      const tool = new WriteFileTool(fs);
      tool.handler({ path: '/hello.txt', content: 'overwritten' });
      expect(fs.readFile('/hello.txt')).toBe('overwritten');
    });

    it('should reject path traversal attempts', () => {
      const fs = createFileSystem();
      const tool = new WriteFileTool(fs);
      expect(() => tool.handler({ path: '/../outside.txt', content: 'bad' })).toThrow(
        FileSystemOperationError,
      );
    });

    it('should require both path and content', () => {
      const fs = createFileSystem();
      const tool = new WriteFileTool(fs);
      expect(tool.parameters.required).toContain('path');
      expect(tool.parameters.required).toContain('content');
    });
  });

  describe('DeleteFileTool', () => {
    it('should delete an existing file', () => {
      const fs = createFileSystem();
      const tool = new DeleteFileTool(fs);
      const result = tool.handler({ path: '/hello.txt' });
      expect(result).toBe('Successfully deleted file "/hello.txt".');
      expect(fs.exists('/hello.txt')).toBe(false);
    });

    it('should throw FileNotFoundError for missing files', () => {
      const fs = createFileSystem();
      const tool = new DeleteFileTool(fs);
      expect(() => tool.handler({ path: '/missing.txt' })).toThrow(FileNotFoundError);
    });

    it('should reject path traversal attempts', () => {
      const fs = createFileSystem();
      const tool = new DeleteFileTool(fs);
      expect(() => tool.handler({ path: '/hello.txt/../../secret' })).toThrow(
        FileSystemOperationError,
      );
    });
  });

  describe('ListDirectoryTool', () => {
    it('should list directory contents', () => {
      const fs = createFileSystem();
      const tool = new ListDirectoryTool(fs);
      const result = tool.handler({ path: '/src' });
      expect(result).toContain('index.ts');
      expect(result).toContain('utils.ts');
      expect(result).toContain('lib/');
    });

    it('should report empty directories', () => {
      const fs = createFileSystem();
      fs.createDirectory('/empty');
      const tool = new ListDirectoryTool(fs);
      const result = tool.handler({ path: '/empty' });
      expect(result).toBe('Directory "/empty" is empty.');
    });

    it('should throw FileNotFoundError for missing directories', () => {
      const fs = createFileSystem();
      const tool = new ListDirectoryTool(fs);
      expect(() => tool.handler({ path: '/missing' })).toThrow(FileNotFoundError);
    });

    it('should reject path traversal attempts', () => {
      const fs = createFileSystem();
      const tool = new ListDirectoryTool(fs);
      expect(() => tool.handler({ path: '/src/../../etc' })).toThrow(FileSystemOperationError);
    });
  });

  describe('SearchWorkspaceTool', () => {
    it('should find matches across files', () => {
      const fs = createFileSystem();
      const tool = new SearchWorkspaceTool(fs);
      const result = tool.handler({ query: 'export' });
      expect(result).toContain('index.ts');
      expect(result).toContain('utils.ts');
      expect(result).toContain('helper.ts');
    });

    it('should be case-insensitive by default', () => {
      const fs = createFileSystem();
      const tool = new SearchWorkspaceTool(fs);
      const result = tool.handler({ query: 'EXPORT' });
      expect(result).toContain('index.ts');
    });

    it('should respect caseSensitive flag', () => {
      const fs = createFileSystem();
      const tool = new SearchWorkspaceTool(fs);
      const result = tool.handler({ query: 'EXPORT', caseSensitive: true });
      expect(result).toBe('No matches found for "EXPORT".');
    });

    it('should limit results with maxResults', () => {
      const fs = createFileSystem();
      const tool = new SearchWorkspaceTool(fs);
      const result = tool.handler({ query: 'export', maxResults: 1 });
      const lines = result.split('\n');
      expect(lines.length).toBeLessThanOrEqual(2); // header + 1 result
    });

    it('should scope search to a given path', () => {
      const fs = createFileSystem();
      const tool = new SearchWorkspaceTool(fs);
      const result = tool.handler({ query: 'export', path: '/src/lib' });
      expect(result).toContain('helper.ts');
      expect(result).not.toContain('index.ts');
    });

    it('should return no matches message when nothing found', () => {
      const fs = createFileSystem();
      const tool = new SearchWorkspaceTool(fs);
      const result = tool.handler({ query: 'ZZZNOTFOUND' });
      expect(result).toBe('No matches found for "ZZZNOTFOUND".');
    });

    it('should report empty query error', () => {
      const fs = createFileSystem();
      const tool = new SearchWorkspaceTool(fs);
      const result = tool.handler({ query: '   ' });
      expect(result).toBe('Search query must not be empty.');
    });
  });

  describe('ExecuteCommandTool', () => {
    it('should echo arguments', async () => {
      const terminal = new SimulatedTerminal();
      const tool = new ExecuteCommandTool(terminal);
      const result = await tool.handler({ command: 'echo Hello World' });
      expect(result).toBe('Hello World');
    });

    it('should return current working directory for pwd', async () => {
      const terminal = new SimulatedTerminal({ workingDirectory: '/workspace' });
      const tool = new ExecuteCommandTool(terminal);
      const result = await tool.handler({ command: 'pwd' });
      expect(result).toBe('/workspace');
    });

    it('should return help for help command', async () => {
      const terminal = new SimulatedTerminal();
      const tool = new ExecuteCommandTool(terminal);
      const result = await tool.handler({ command: 'help' });
      expect(result).toContain('echo');
      expect(result).toContain('pwd');
    });

    it('should return an error for unknown commands', async () => {
      const terminal = new SimulatedTerminal();
      const tool = new ExecuteCommandTool(terminal);
      const result = await tool.handler({ command: 'rm -rf /' });
      expect(result).toContain('Unknown command');
    });

    it('should timeout long-running commands', async () => {
      const terminal = new SimulatedTerminal();
      const tool = new ExecuteCommandTool(terminal);
      const result = await tool.handler({ command: 'sleep 200', timeoutMs: 50 });
      expect(result).toContain('timed out');
    });

    it('should handle empty command', async () => {
      const terminal = new SimulatedTerminal();
      const tool = new ExecuteCommandTool(terminal);
      const result = await tool.handler({ command: '   ' });
      expect(result).toBe('Error: command must not be empty.');
    });

    it('should truncate very long output', async () => {
      const terminal = new SimulatedTerminal({ maxOutputLength: 10 });
      const tool = new ExecuteCommandTool(terminal);
      const result = await tool.handler({ command: 'echo This is a very long output string' });
      expect(result).toContain('... (output truncated)');
    });
  });

  describe('ITool interface compliance', () => {
    const fs = createFileSystem();
    const tools: ITool[] = [
      new ReadFileTool(fs),
      new WriteFileTool(fs),
      new DeleteFileTool(fs),
      new ListDirectoryTool(fs),
      new SearchWorkspaceTool(fs),
      new ExecuteCommandTool(new SimulatedTerminal()),
    ];

    it('all builtin tools should implement ITool', () => {
      for (const tool of tools) {
        expect(typeof tool.name).toBe('string');
        expect(tool.name.length).toBeGreaterThan(0);
        expect(typeof tool.description).toBe('string');
        expect(tool.description.length).toBeGreaterThan(0);
        expect(tool.parameters.type).toBe('object');
        expect(typeof tool.parameters.properties).toBe('object');
        expect(Array.isArray(tool.parameters.required)).toBe(true);
        expect(typeof tool.handler).toBe('function');
      }
    });

    it('all builtin tools should have unique names', () => {
      const names = tools.map((t) => t.name);
      expect(new Set(names).size).toBe(names.length);
    });
  });
});

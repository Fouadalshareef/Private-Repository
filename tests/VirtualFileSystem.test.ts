import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { VirtualFileSystem } from '../src/filesystem/VirtualFileSystem.js';
import {
  FileNotFoundError,
  FileAlreadyExistsError,
  FileSystemOperationError,
} from '../src/filesystem/FileSystemError.js';
import { FileSystemEvents } from '../src/filesystem/FileSystemEvents.js';
import type { IFileSystem } from '../src/filesystem/IFileSystem.js';
import type { FileInfo } from '../src/filesystem/FileInfo.js';
import type { DirectoryInfo } from '../src/filesystem/DirectoryInfo.js';

describe('VirtualFileSystem', () => {
  let fs: VirtualFileSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T00:00:00.000Z'));
    fs = new VirtualFileSystem();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── file creation (writeFile) ────────────────────────────────

  it('should write a file to the root', () => {
    fs.writeFile('/hello.txt', 'Hello');

    expect(fs.exists('/hello.txt')).toBe(true);
    expect(fs.readFile('/hello.txt')).toBe('Hello');
  });

  it('should write a file in a subdirectory', () => {
    fs.createDirectory('/src');
    fs.writeFile('/src/main.ts', 'export const x = 1;');

    expect(fs.exists('/src/main.ts')).toBe(true);
    expect(fs.readFile('/src/main.ts')).toBe('export const x = 1;');
  });

  it('should normalize paths when writing', () => {
    fs.createDirectory('\\folder');
    fs.writeFile('\\folder\\file.txt', 'content');
    expect(fs.exists('/folder/file.txt')).toBe(true);
    expect(fs.readFile('/folder/file.txt')).toBe('content');
  });

  it('should update an existing file', () => {
    fs.writeFile('/file.txt', 'v1');
    fs.writeFile('/file.txt', 'v2');

    expect(fs.readFile('/file.txt')).toBe('v2');
  });

  it('should throw when writing to a directory path', () => {
    fs.createDirectory('/folder');
    expect(() => fs.writeFile('/folder', 'content')).toThrow(FileSystemOperationError);
  });

  it('should throw when writing to a file whose parent directory does not exist', () => {
    expect(() => fs.writeFile('/no/such/dir/file.txt', 'content')).toThrow(
      FileNotFoundError,
    );
  });

  // ── file reading ─────────────────────────────────────────────

  it('should read a file', () => {
    fs.writeFile('/data.txt', 'some data');
    expect(fs.readFile('/data.txt')).toBe('some data');
  });

  it('should throw when reading a non-existent file', () => {
    expect(() => fs.readFile('/missing.txt')).toThrow(FileNotFoundError);
  });

  it('should throw when reading a directory', () => {
    fs.createDirectory('/folder');
    expect(() => fs.readFile('/folder')).toThrow(FileSystemOperationError);
  });

  // ── file deletion ────────────────────────────────────────────

  it('should delete a file', () => {
    fs.writeFile('/delete-me.txt', 'content');
    fs.delete('/delete-me.txt');

    expect(fs.exists('/delete-me.txt')).toBe(false);
  });

  it('should throw when deleting a non-existent file', () => {
    expect(() => fs.delete('/missing.txt')).toThrow(FileNotFoundError);
  });

  it('should throw when deleting a directory with delete()', () => {
    fs.createDirectory('/folder');
    expect(() => fs.delete('/folder')).toThrow(FileSystemOperationError);
  });

  // ── directory creation ───────────────────────────────────────

  it('should create a directory', () => {
    fs.createDirectory('/src');

    expect(fs.exists('/src')).toBe(true);
  });

  it('should throw when creating an existing directory', () => {
    fs.createDirectory('/src');
    expect(() => fs.createDirectory('/src')).toThrow(FileAlreadyExistsError);
  });

  it('should throw when creating a directory whose parent does not exist', () => {
    expect(() => fs.createDirectory('/a/b/c')).toThrow(FileNotFoundError);
  });

  it('should throw when creating a directory with the same path as an existing file', () => {
    fs.writeFile('/conflict', 'content');
    expect(() => fs.createDirectory('/conflict')).toThrow(FileAlreadyExistsError);
  });

  it('should throw when creating the root directory', () => {
    expect(() => fs.createDirectory('/')).toThrow(FileAlreadyExistsError);
  });

  // ── directory deletion ───────────────────────────────────────

  it('should delete an empty directory', () => {
    fs.createDirectory('/empty');
    fs.deleteDirectory('/empty');

    expect(fs.exists('/empty')).toBe(false);
  });

  it('should delete a directory and all of its contents', () => {
    fs.createDirectory('/project');
    fs.createDirectory('/project/src');
    fs.writeFile('/project/src/main.ts', 'code');
    fs.writeFile('/project/readme.md', 'docs');

    fs.deleteDirectory('/project');

    expect(fs.exists('/project')).toBe(false);
    expect(fs.exists('/project/src')).toBe(false);
    expect(fs.exists('/project/src/main.ts')).toBe(false);
    expect(fs.exists('/project/readme.md')).toBe(false);
  });

  it('should throw when deleting a non-existent directory', () => {
    expect(() => fs.deleteDirectory('/missing')).toThrow(FileNotFoundError);
  });

  it('should throw when deleting a file with deleteDirectory()', () => {
    fs.writeFile('/file.txt', 'content');
    expect(() => fs.deleteDirectory('/file.txt')).toThrow(FileSystemOperationError);
  });

  it('should throw when deleting the root directory', () => {
    expect(() => fs.deleteDirectory('/')).toThrow(FileSystemOperationError);
  });

  // ── exists ───────────────────────────────────────────────────

  it('should return false for non-existent paths', () => {
    expect(fs.exists('/missing')).toBe(false);
  });

  it('should return true for the root directory', () => {
    expect(fs.exists('/')).toBe(true);
  });

  it('should return true for existing files and directories', () => {
    fs.writeFile('/file.txt', 'content');
    fs.createDirectory('/folder');

    expect(fs.exists('/file.txt')).toBe(true);
    expect(fs.exists('/folder')).toBe(true);
  });

  // ── move ─────────────────────────────────────────────────────

  it('should move a file', () => {
    fs.writeFile('/source.txt', 'content');
    fs.move('/source.txt', '/dest.txt');

    expect(fs.exists('/source.txt')).toBe(false);
    expect(fs.exists('/dest.txt')).toBe(true);
    expect(fs.readFile('/dest.txt')).toBe('content');
  });

  it('should move a file into a directory', () => {
    fs.createDirectory('/folder');
    fs.writeFile('/source.txt', 'content');
    fs.move('/source.txt', '/folder/source.txt');

    expect(fs.exists('/source.txt')).toBe(false);
    expect(fs.readFile('/folder/source.txt')).toBe('content');
  });

  it('should move a directory with its contents', () => {
    fs.createDirectory('/old');
    fs.writeFile('/old/a.txt', 'A');
    fs.createDirectory('/old/nested');
    fs.writeFile('/old/nested/b.txt', 'B');

    fs.move('/old', '/new');

    expect(fs.exists('/old')).toBe(false);
    expect(fs.exists('/new')).toBe(true);
    expect(fs.readFile('/new/a.txt')).toBe('A');
    expect(fs.readFile('/new/nested/b.txt')).toBe('B');
  });

  it('should throw when moving a non-existent path', () => {
    expect(() => fs.move('/missing', '/dest')).toThrow(FileNotFoundError);
  });

  it('should throw when moving to an existing destination', () => {
    fs.writeFile('/a.txt', 'A');
    fs.writeFile('/b.txt', 'B');
    expect(() => fs.move('/a.txt', '/b.txt')).toThrow(FileAlreadyExistsError);
  });

  it('should throw when source and destination are the same', () => {
    fs.writeFile('/a.txt', 'A');
    expect(() => fs.move('/a.txt', '/a.txt')).toThrow(FileSystemOperationError);
  });

  it('should throw when destination parent directory does not exist', () => {
    fs.writeFile('/a.txt', 'A');
    expect(() => fs.move('/a.txt', '/no/such/dir/a.txt')).toThrow(FileNotFoundError);
  });

  // ── copy ─────────────────────────────────────────────────────

  it('should copy a file', () => {
    fs.writeFile('/source.txt', 'content');
    fs.copy('/source.txt', '/copy.txt');

    expect(fs.exists('/source.txt')).toBe(true);
    expect(fs.exists('/copy.txt')).toBe(true);
    expect(fs.readFile('/copy.txt')).toBe('content');
  });

  it('should copy a directory with its contents', () => {
    fs.createDirectory('/src');
    fs.writeFile('/src/a.txt', 'A');
    fs.writeFile('/src/b.txt', 'B');

    fs.copy('/src', '/src-copy');

    expect(fs.exists('/src')).toBe(true);
    expect(fs.exists('/src-copy')).toBe(true);
    expect(fs.readFile('/src-copy/a.txt')).toBe('A');
    expect(fs.readFile('/src-copy/b.txt')).toBe('B');
  });

  it('should throw when copying a non-existent path', () => {
    expect(() => fs.copy('/missing', '/dest')).toThrow(FileNotFoundError);
  });

  it('should throw when copying to an existing destination', () => {
    fs.writeFile('/a.txt', 'A');
    fs.writeFile('/b.txt', 'B');
    expect(() => fs.copy('/a.txt', '/b.txt')).toThrow(FileAlreadyExistsError);
  });

  it('should throw when source and destination are the same', () => {
    fs.writeFile('/a.txt', 'A');
    expect(() => fs.copy('/a.txt', '/a.txt')).toThrow(FileSystemOperationError);
  });

  // ── listing ──────────────────────────────────────────────────

  it('should list the root directory', () => {
    fs.writeFile('/a.txt', 'A');
    fs.createDirectory('/folder');
    fs.writeFile('/folder/b.txt', 'B');

    const entries = fs.list('/');
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(['a.txt', 'folder']),
    );
  });

  it('should list a nested directory', () => {
    fs.createDirectory('/folder');
    fs.writeFile('/folder/a.txt', 'A');
    fs.writeFile('/folder/b.txt', 'B');

    const entries = fs.list('/folder');
    expect(entries).toHaveLength(2);
  });

  it('should list only immediate children', () => {
    fs.createDirectory('/outer');
    fs.createDirectory('/outer/inner');
    fs.writeFile('/outer/file.txt', 'F');
    fs.writeFile('/outer/inner/deep.txt', 'D');

    const entries = fs.list('/outer');
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(['inner', 'file.txt']),
    );
  });

  it('should return an empty list for an empty directory', () => {
    fs.createDirectory('/empty');
    expect(fs.list('/empty')).toEqual([]);
  });

  it('should throw when listing a non-existent directory', () => {
    expect(() => fs.list('/missing')).toThrow(FileNotFoundError);
  });

  it('should throw when listing a file', () => {
    fs.writeFile('/file.txt', 'content');
    expect(() => fs.list('/file.txt')).toThrow(FileSystemOperationError);
  });

  // ── metadata (stat) ──────────────────────────────────────────

  it('should stat a file', () => {
    fs.writeFile('/file.txt', '12345');

    const info = fs.stat('/file.txt') as FileInfo;
    expect(info.name).toBe('file.txt');
    expect(info.path).toBe('/file.txt');
    expect(info.size).toBe(5);
    expect(info.isDirectory).toBe(false);
    expect(info.createdAt).toBe(Date.now());
    expect(info.modifiedAt).toBe(Date.now());
  });

  it('should stat a directory', () => {
    fs.createDirectory('/folder');

    const info = fs.stat('/folder') as DirectoryInfo;
    expect(info.name).toBe('folder');
    expect(info.path).toBe('/folder');
    expect(info.isDirectory).toBe(true);
  });

  it('should stat the root directory', () => {
    const info = fs.stat('/') as DirectoryInfo;
    expect(info.path).toBe('/');
    expect(info.isDirectory).toBe(true);
  });

  it('should report directory size as sum of contained files', () => {
    fs.createDirectory('/folder');
    fs.writeFile('/folder/a.txt', '123');
    fs.writeFile('/folder/b.txt', '12345');

    const info = fs.stat('/folder') as DirectoryInfo;
    expect(info.size).toBe(8);
  });

  it('should throw when statting a non-existent path', () => {
    expect(() => fs.stat('/missing')).toThrow(FileNotFoundError);
  });

  // ── read-only ────────────────────────────────────────────────

  it('should prevent write operations when read-only', () => {
    const readOnlyFs = new VirtualFileSystem({ readOnly: true });

    expect(() => readOnlyFs.writeFile('/a.txt', 'A')).toThrow(FileSystemOperationError);
    expect(() => readOnlyFs.createDirectory('/dir')).toThrow(FileSystemOperationError);
    expect(() => readOnlyFs.delete('/a.txt')).toThrow(FileSystemOperationError);
    expect(() => readOnlyFs.move('/a', '/b')).toThrow(FileSystemOperationError);
    expect(() => readOnlyFs.copy('/a', '/b')).toThrow(FileSystemOperationError);
    expect(() => readOnlyFs.deleteDirectory('/dir')).toThrow(FileSystemOperationError);
  });

  it('should allow read operations when read-only', () => {
    const readOnlyFs = new VirtualFileSystem({ readOnly: true });

    expect(readOnlyFs.exists('/')).toBe(true);
    expect(readOnlyFs.stat('/')).toBeDefined();
    expect(readOnlyFs.list('/')).toEqual([]);
    expect(() => readOnlyFs.readFile('/missing.txt')).toThrow(FileNotFoundError);
  });

  // ── interface conformance ────────────────────────────────────

  it('should conform to the IFileSystem interface', () => {
    const fileSystem: IFileSystem = fs;
    expect(fileSystem.exists).toBeTypeOf('function');
    expect(fileSystem.readFile).toBeTypeOf('function');
    expect(fileSystem.writeFile).toBeTypeOf('function');
    expect(fileSystem.delete).toBeTypeOf('function');
    expect(fileSystem.move).toBeTypeOf('function');
    expect(fileSystem.copy).toBeTypeOf('function');
    expect(fileSystem.createDirectory).toBeTypeOf('function');
    expect(fileSystem.deleteDirectory).toBeTypeOf('function');
    expect(fileSystem.list).toBeTypeOf('function');
    expect(fileSystem.stat).toBeTypeOf('function');
  });

  // ── options ──────────────────────────────────────────────────

  it('should return a copy of options', () => {
    const fsWithOptions = new VirtualFileSystem({ readOnly: true, watchChanges: true });
    const options = fsWithOptions.getOptions();
    options.readOnly = false;
    expect(fsWithOptions.getOptions().readOnly).toBe(true);
    expect(fsWithOptions.getOptions().watchChanges).toBe(true);
  });

  // ── events (definitions only) ────────────────────────────────

  it('should define file system event names', () => {
    expect(FileSystemEvents.FILE_CREATED).toBe('filesystem.file.created');
    expect(FileSystemEvents.FILE_UPDATED).toBe('filesystem.file.updated');
    expect(FileSystemEvents.FILE_DELETED).toBe('filesystem.file.deleted');
    expect(FileSystemEvents.DIRECTORY_CREATED).toBe('filesystem.directory.created');
    expect(FileSystemEvents.DIRECTORY_DELETED).toBe('filesystem.directory.deleted');
  });
});
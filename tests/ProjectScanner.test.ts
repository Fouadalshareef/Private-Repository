import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ProjectScanner } from '../src/project/ProjectScanner.js';
import { Workspace } from '../src/workspace/Workspace.js';
import { VirtualFileSystem } from '../src/filesystem/VirtualFileSystem.js';
import {
  ProjectScannerError,
  WorkspaceNotOpenError,
  ProjectRootNotFoundError,
} from '../src/project/ProjectScannerError.js';
import { ProjectScannerEvents } from '../src/project/ProjectScannerEvents.js';
import type { IProjectScanner } from '../src/project/IProjectScanner.js';
import type { ProjectScanResult } from '../src/project/ProjectScanResult.js';
import type { ProjectFile } from '../src/project/ProjectFile.js';
import type { ProjectDirectory } from '../src/project/ProjectDirectory.js';

/**
 * Creates a workspace with the given root path, opens it, and populates
 * the file system.
 */
function createOpenWorkspace(fs: VirtualFileSystem, rootPath: string): Workspace {
  // The root directory for the workspace is created in the file system.
  fs.createDirectory(rootPath);
  const workspace = new Workspace();
  workspace.create('ws-1', 'Test Project', rootPath);
  workspace.open();
  return workspace;
}

describe('ProjectScanner', () => {
  let fs: VirtualFileSystem;
  let scanner: ProjectScanner;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T00:00:00.000Z'));
    fs = new VirtualFileSystem();
    scanner = new ProjectScanner(fs);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── empty workspace ──────────────────────────────────────────

  it('should scan an empty workspace', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    const result = scanner.scan(workspace);

    expect(result.files).toEqual([]);
    expect(result.directories).toEqual([]);
    expect(result.statistics.totalFiles).toBe(0);
    expect(result.statistics.totalDirectories).toBe(0);
    expect(result.statistics.totalSize).toBe(0);
    expect(result.statistics.extensions.size).toBe(0);
  });

  it('should return project info for an empty workspace', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    const result = scanner.scan(workspace);

    expect(result.info.projectId).toBe('ws-1');
    expect(result.info.projectName).toBe('Test Project');
    expect(result.info.rootPath).toBe('/project');
    expect(result.info.scannedAt).toBe(Date.now());
    expect(result.info.createdAt).toBe(workspace.getInfo().createdAt);
  });

  // ── single file ──────────────────────────────────────────────

  it('should scan a workspace with a single file', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.writeFile('/project/readme.md', 'Hello');

    const result = scanner.scan(workspace);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toMatchObject({
      path: 'readme.md',
      name: 'readme.md',
      extension: '.md',
      size: 5,
    });
    expect(result.statistics.totalFiles).toBe(1);
    expect(result.statistics.totalSize).toBe(5);
  });

  // ── multiple directories ─────────────────────────────────────

  it('should scan multiple directories recursively', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.createDirectory('/project/src');
    fs.createDirectory('/project/src/components');
    fs.createDirectory('/project/tests');
    fs.writeFile('/project/package.json', '{}');
    fs.writeFile('/project/src/index.ts', 'code');
    fs.writeFile('/project/src/components/Button.ts', 'code');
    fs.writeFile('/project/tests/index.test.ts', 'code');

    const result = scanner.scan(workspace);

    expect(result.files).toHaveLength(4);
    expect(result.directories).toHaveLength(3);

    const dirPaths = result.directories.map((dir) => dir.path);
    expect(dirPaths).toEqual(expect.arrayContaining(['src', 'src/components', 'tests']));

    const filePaths = result.files.map((file) => file.path);
    expect(filePaths).toEqual(
      expect.arrayContaining([
        'package.json',
        'src/index.ts',
        'src/components/Button.ts',
        'tests/index.test.ts',
      ]),
    );
  });

  it('should assign correct depths to directories', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.createDirectory('/project/src');
    fs.createDirectory('/project/src/components');

    const result = scanner.scan(workspace);

    const src = result.directories.find((dir) => dir.path === 'src');
    const components = result.directories.find((dir) => dir.path === 'src/components');

    expect(src?.depth).toBe(0);
    expect(components?.depth).toBe(1);
  });

  // ── statistics ───────────────────────────────────────────────

  it('should compute statistics correctly', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.writeFile('/project/a.ts', '12345');
    fs.writeFile('/project/b.ts', '123');
    fs.writeFile('/project/c.js', '12');

    const result = scanner.scan(workspace);

    expect(result.statistics.totalFiles).toBe(3);
    expect(result.statistics.totalSize).toBe(10);
    expect(result.statistics.extensions.get('.ts')).toBe(2);
    expect(result.statistics.extensions.get('.js')).toBe(1);
  });

  it('should compute statistics for files without extensions', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.writeFile('/project/Makefile', 'all:');

    const result = scanner.scan(workspace);

    expect(result.statistics.totalFiles).toBe(1);
    expect(result.statistics.extensions.get('')).toBe(1);
    expect(result.files[0].extension).toBe('');
  });

  // ── hidden files ─────────────────────────────────────────────

  it('should exclude hidden files by default', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.writeFile('/project/.env', 'SECRET');
    fs.writeFile('/project/app.ts', 'code');

    const result = scanner.scan(workspace);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].name).toBe('app.ts');
  });

  it('should exclude hidden directories by default', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.createDirectory('/project/.git');
    fs.writeFile('/project/.git/config', 'data');
    fs.writeFile('/project/app.ts', 'code');

    const result = scanner.scan(workspace);

    expect(result.files).toHaveLength(1);
    expect(result.directories).toHaveLength(0);
  });

  it('should include hidden files and directories when enabled', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.createDirectory('/project/.git');
    fs.writeFile('/project/.env', 'SECRET');
    fs.writeFile('/project/.git/config', 'data');

    const result = scanner.scan(workspace, { includeHidden: true });

    expect(result.files).toHaveLength(2);
    expect(result.directories).toHaveLength(1);
  });

  // ── max depth ────────────────────────────────────────────────

  it('should limit scan depth with maxDepth', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.createDirectory('/project/a');
    fs.createDirectory('/project/a/b');
    fs.createDirectory('/project/a/b/c');
    fs.writeFile('/project/root.ts', 'A');
    fs.writeFile('/project/a/one.ts', 'B');
    fs.writeFile('/project/a/b/two.ts', 'C');
    fs.writeFile('/project/a/b/c/three.ts', 'D');

    const result = scanner.scan(workspace, { maxDepth: 1 });

    expect(result.files.map((f) => f.path)).toEqual(['root.ts', 'a/one.ts']);
    expect(result.directories.map((d) => d.path)).toEqual(['a']);
  });

  it('should scan everything when maxDepth is not set', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.createDirectory('/project/a');
    fs.createDirectory('/project/a/b');
    fs.writeFile('/project/a/b/deep.ts', 'D');

    const result = scanner.scan(workspace);

    expect(result.files).toHaveLength(1);
    expect(result.directories).toHaveLength(2);
  });

  // ── ignored directories ──────────────────────────────────────

  it('should ignore specified directories', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.createDirectory('/project/node_modules');
    fs.createDirectory('/project/src');
    fs.writeFile('/project/node_modules/x.js', 'X');
    fs.writeFile('/project/src/app.ts', 'A');

    const result = scanner.scan(workspace, {
      ignoredDirectories: ['node_modules'],
    });

    expect(result.files.map((f) => f.path)).toEqual(['src/app.ts']);
    expect(result.directories.map((d) => d.path)).toEqual(['src']);
  });

  it('should ignore nested ignored directories', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.createDirectory('/project/src');
    fs.createDirectory('/project/src/node_modules');
    fs.writeFile('/project/src/node_modules/lib.js', 'L');
    fs.writeFile('/project/src/app.ts', 'A');

    const result = scanner.scan(workspace, {
      ignoredDirectories: ['node_modules'],
    });

    expect(result.files.map((f) => f.path)).toEqual(['src/app.ts']);
    expect(result.directories.map((d) => d.path)).toEqual(['src']);
  });

  // ── ignored extensions ───────────────────────────────────────

  it('should ignore files with specified extensions', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.writeFile('/project/app.ts', 'A');
    fs.writeFile('/project/debug.log', 'LOG');
    fs.writeFile('/project/temp.tmp', 'TMP');

    const result = scanner.scan(workspace, {
      ignoredExtensions: ['.log', '.tmp'],
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0].name).toBe('app.ts');
  });

  // ── non-recursive ────────────────────────────────────────────

  it('should only scan the top level when recursive is false', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.createDirectory('/project/src');
    fs.writeFile('/project/src/app.ts', 'A');
    fs.writeFile('/project/root.ts', 'R');

    const result = scanner.scan(workspace, { recursive: false });

    expect(result.files.map((f) => f.path)).toEqual(['root.ts']);
    expect(result.directories.map((d) => d.path)).toEqual(['src']);
  });

  // ── scan results / accessors ─────────────────────────────────

  it('should return a ProjectScanResult shaped result', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.writeFile('/project/app.ts', 'A');

    const result: ProjectScanResult = scanner.scan(workspace);

    expect(result.info).toBeDefined();
    expect(result.files).toBeDefined();
    expect(result.directories).toBeDefined();
    expect(result.statistics).toBeDefined();
  });

  it('should expose getProjectInfo after scan', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    scanner.scan(workspace);

    const info = scanner.getProjectInfo();
    expect(info.projectId).toBe('ws-1');
    expect(info.projectName).toBe('Test Project');
  });

  it('should expose getFiles after scan', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.writeFile('/project/a.ts', 'A');
    scanner.scan(workspace);

    const files = scanner.getFiles();
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('a.ts');
  });

  it('should expose getDirectories after scan', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.createDirectory('/project/src');
    scanner.scan(workspace);

    const dirs = scanner.getDirectories();
    expect(dirs).toHaveLength(1);
    expect(dirs[0].name).toBe('src');
  });

  it('should expose getStatistics after scan', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.writeFile('/project/a.ts', '123');
    scanner.scan(workspace);

    const stats = scanner.getStatistics();
    expect(stats.totalFiles).toBe(1);
    expect(stats.totalSize).toBe(3);
  });

  it('should throw when getting info before scan', () => {
    expect(() => scanner.getProjectInfo()).toThrow(ProjectScannerError);
  });

  it('should throw when getting files before scan', () => {
    expect(() => scanner.getFiles()).toThrow(ProjectScannerError);
  });

  it('should throw when getting directories before scan', () => {
    expect(() => scanner.getDirectories()).toThrow(ProjectScannerError);
  });

  it('should throw when getting statistics before scan', () => {
    expect(() => scanner.getStatistics()).toThrow(ProjectScannerError);
  });

  it('should return a defensive copy of files', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.writeFile('/project/a.ts', 'A');
    scanner.scan(workspace);

    const files = scanner.getFiles() as ProjectFile[];
    (files[0] as { name: string }).name = 'mutated';

    expect(scanner.getFiles()[0].name).toBe('a.ts');
  });

  it('should return a defensive copy of directories', () => {
    const workspace = createOpenWorkspace(fs, '/project');
    fs.createDirectory('/project/src');
    scanner.scan(workspace);

    const dirs = scanner.getDirectories() as ProjectDirectory[];
    (dirs[0] as { name: string }).name = 'mutated';

    expect(scanner.getDirectories()[0].name).toBe('src');
  });

  // ── errors ───────────────────────────────────────────────────

  it('should throw WorkspaceNotOpenError when scanning a closed workspace', () => {
    const workspace = new Workspace();
    workspace.create('ws-1', 'Test', '/project');
    // Not opened.

    expect(() => scanner.scan(workspace)).toThrow(WorkspaceNotOpenError);
  });

  it('should throw ProjectRootNotFoundError when root does not exist', () => {
    const workspace = new Workspace();
    workspace.create('ws-1', 'Test', '/missing-project');
    workspace.open();

    expect(() => scanner.scan(workspace)).toThrow(ProjectRootNotFoundError);
  });

  // ── interface conformance ────────────────────────────────────

  it('should conform to the IProjectScanner interface', () => {
    const scannerInterface: IProjectScanner = scanner;
    expect(scannerInterface.scan).toBeTypeOf('function');
    expect(scannerInterface.getProjectInfo).toBeTypeOf('function');
    expect(scannerInterface.getFiles).toBeTypeOf('function');
    expect(scannerInterface.getDirectories).toBeTypeOf('function');
    expect(scannerInterface.getStatistics).toBeTypeOf('function');
  });

  // ── events (definitions only) ────────────────────────────────

  it('should define project scanner event names', () => {
    expect(ProjectScannerEvents.SCAN_STARTED).toBe('project.scan.started');
    expect(ProjectScannerEvents.SCAN_COMPLETED).toBe('project.scan.completed');
    expect(ProjectScannerEvents.SCAN_FAILED).toBe('project.scan.failed');
  });
});
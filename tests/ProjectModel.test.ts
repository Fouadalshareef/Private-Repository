import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ProjectModelBuilder } from '../src/model/ProjectModelBuilder.js';
import { ProjectFileNode } from '../src/model/ProjectFileNode.js';
import { ProjectDirectoryNode } from '../src/model/ProjectDirectoryNode.js';
import { ProjectNodeType } from '../src/model/ProjectNodeType.js';
import { ProjectModelError } from '../src/model/ProjectModelError.js';
import { ProjectModelEvents } from '../src/model/ProjectModelEvents.js';
import type { ProjectModelVisitor } from '../src/model/ProjectModelVisitor.js';
import type { ProjectScanResult } from '../src/project/ProjectScanResult.js';
import type { ProjectInfo } from '../src/project/ProjectInfo.js';
import type { ProjectFile } from '../src/project/ProjectFile.js';
import type { ProjectDirectory } from '../src/project/ProjectDirectory.js';

/**
 * Creates a scan result for testing.
 */
function createScanResult(
  overrides?: Partial<ProjectScanResult>,
): ProjectScanResult {
  const info: ProjectInfo = {
    projectId: 'proj-1',
    projectName: 'Test Project',
    rootPath: '/project',
    createdAt: 1000,
    scannedAt: 2000,
  };
  const files: ProjectFile[] = [
    {
      path: 'package.json',
      name: 'package.json',
      extension: '.json',
      size: 10,
      createdAt: 1000,
      modifiedAt: 1000,
    },
    {
      path: 'src/index.ts',
      name: 'index.ts',
      extension: '.ts',
      size: 20,
      createdAt: 1000,
      modifiedAt: 1000,
    },
    {
      path: 'src/components/Button.ts',
      name: 'Button.ts',
      extension: '.ts',
      size: 30,
      createdAt: 1000,
      modifiedAt: 1000,
    },
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
      totalSize: 60,
      extensions: new Map([['.json', 1], ['.ts', 2]]),
    },
    ...overrides,
  };
}

describe('ProjectModelBuilder', () => {
  let builder: ProjectModelBuilder;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T00:00:00.000Z'));
    builder = new ProjectModelBuilder();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── tree creation ────────────────────────────────────────────

  it('should build a project model from a scan result', () => {
    const model = builder.build(createScanResult());

    expect(model.info.projectId).toBe('proj-1');
    expect(model.info.projectName).toBe('Test Project');
    expect(model.tree).toBeDefined();
  });

  it('should create a root node of type PROJECT', () => {
    const model = builder.build(createScanResult());
    const root = model.tree.root();

    expect(root.type).toBe(ProjectNodeType.PROJECT);
    expect(root.id).toBe('proj-1');
    expect(root.name).toBe('Test Project');
    expect(root.path).toBe('');
    expect(root.isRoot()).toBe(true);
  });

  it('should create a tree with all nodes', () => {
    const model = builder.build(createScanResult());
    const nodes: string[] = [];
    model.tree.walk((node) => nodes.push(node.path));

    expect(nodes).toEqual(
      expect.arrayContaining(['', 'package.json', 'src', 'src/index.ts', 'src/components', 'src/components/Button.ts']),
    );
  });

  // ── node hierarchy ───────────────────────────────────────────

  it('should wire parent/child relationships correctly', () => {
    const model = builder.build(createScanResult());
    const root = model.tree.root();

    expect(root.children).toHaveLength(2); // package.json + src

    const src = model.tree.findByPath('src');
    expect(src?.children).toHaveLength(2); // index.ts + components

    const components = model.tree.findByPath('src/components');
    expect(components?.children).toHaveLength(1); // Button.ts
  });

  it('should set parent references correctly', () => {
    const model = builder.build(createScanResult());

    const src = model.tree.findByPath('src');
    expect(src?.parent?.path).toBe('');

    const index = model.tree.findByPath('src/index.ts');
    expect(index?.parent?.path).toBe('src');

    const button = model.tree.findByPath('src/components/Button.ts');
    expect(button?.parent?.path).toBe('src/components');
  });

  it('should create file nodes with correct type and metadata', () => {
    const model = builder.build(createScanResult());
    const file = model.tree.findByPath('src/index.ts') as ProjectFileNode;

    expect(file.type).toBe(ProjectNodeType.FILE);
    expect(file.extension).toBe('.ts');
    expect(file.size).toBe(20);
    expect(file.modifiedAt).toBe(1000);
  });

  it('should create directory nodes with correct type and depth', () => {
    const model = builder.build(createScanResult());
    const src = model.tree.findByPath('src') as ProjectDirectoryNode;
    const components = model.tree.findByPath('src/components') as ProjectDirectoryNode;

    expect(src.type).toBe(ProjectNodeType.DIRECTORY);
    expect(src.depth).toBe(0);
    expect(components.depth).toBe(1);
  });

  // ── find() ───────────────────────────────────────────────────

  it('should find a node by predicate', () => {
    const model = builder.build(createScanResult());
    const found = model.tree.find((node) => node.name === 'Button.ts');

    expect(found?.path).toBe('src/components/Button.ts');
  });

  it('should return undefined when no node matches', () => {
    const model = builder.build(createScanResult());
    const found = model.tree.find((node) => node.name === 'missing');

    expect(found).toBeUndefined();
  });

  // ── findByPath() ─────────────────────────────────────────────

  it('should find a node by path', () => {
    const model = builder.build(createScanResult());
    const node = model.tree.findByPath('src/index.ts');

    expect(node?.id).toBe('proj-1:file:src/index.ts');
  });

  it('should return undefined for a non-existent path', () => {
    const model = builder.build(createScanResult());
    expect(model.tree.findByPath('missing/path')).toBeUndefined();
  });

  // ── findById() ───────────────────────────────────────────────

  it('should find a node by ID', () => {
    const model = builder.build(createScanResult());
    const node = model.tree.findById('proj-1:file:src/index.ts');

    expect(node?.path).toBe('src/index.ts');
  });

  it('should return undefined for a non-existent ID', () => {
    const model = builder.build(createScanResult());
    expect(model.tree.findById('missing-id')).toBeUndefined();
  });

  // ── contains() ───────────────────────────────────────────────

  it('should return true when a matching node exists', () => {
    const model = builder.build(createScanResult());
    expect(model.tree.contains((node) => node.name === 'Button.ts')).toBe(true);
  });

  it('should return false when no matching node exists', () => {
    const model = builder.build(createScanResult());
    expect(model.tree.contains((node) => node.name === 'missing')).toBe(false);
  });

  // ── walk() ───────────────────────────────────────────────────

  it('should walk the tree in depth-first pre-order', () => {
    const model = builder.build(createScanResult());
    const visited: string[] = [];
    model.tree.walk((node) => visited.push(node.path));

    // Root first, then children in order.
    expect(visited[0]).toBe('');
    expect(visited).toContain('package.json');
    expect(visited).toContain('src');
    expect(visited).toContain('src/index.ts');
    expect(visited).toContain('src/components');
    expect(visited).toContain('src/components/Button.ts');
  });

  it('should visit every node exactly once', () => {
    const model = builder.build(createScanResult());
    const visited = new Set<string>();
    model.tree.walk((node) => visited.add(node.path));

    expect(visited.size).toBe(6);
  });

  // ── visitor ──────────────────────────────────────────────────

  it('should visit nodes using a visitor', () => {
    const model = builder.build(createScanResult());
    const visited: string[] = [];

    const visitor: ProjectModelVisitor = {
      visitNode: (node) => {
        visited.push(node.path);
      },
    };

    model.tree.visit(visitor);
    expect(visited).toHaveLength(6);
  });

  it('should call type-specific visit methods', () => {
    const model = builder.build(createScanResult());
    const projects: string[] = [];
    const directories: string[] = [];
    const files: string[] = [];

    const visitor: ProjectModelVisitor = {
      visitProject: (node) => projects.push(node.path),
      visitDirectory: (node) => directories.push(node.path),
      visitFile: (node) => files.push(node.path),
    };

    model.tree.visit(visitor);

    expect(projects).toEqual(['']);
    expect(directories).toEqual(expect.arrayContaining(['src', 'src/components']));
    expect(files).toEqual(
      expect.arrayContaining(['package.json', 'src/index.ts', 'src/components/Button.ts']),
    );
  });

  it('should call visitNode for every node', () => {
    const model = builder.build(createScanResult());
    let count = 0;

    const visitor: ProjectModelVisitor = {
      visitNode: () => {
        count++;
      },
    };

    model.tree.visit(visitor);
    expect(count).toBe(6);
  });

  // ── builder errors ───────────────────────────────────────────

  it('should throw when a parent directory is missing', () => {
    const scanResult = createScanResult();
    // Remove the 'src' directory but keep 'src/index.ts' file.
    const brokenResult: ProjectScanResult = {
      ...scanResult,
      directories: scanResult.directories.filter((d) => d.path !== 'src'),
    };

    expect(() => builder.build(brokenResult)).toThrow(ProjectModelError);
  });

  // ── immutability ─────────────────────────────────────────────

  it('should not mutate the original scan result info', () => {
    const scanResult = createScanResult();
    const model = builder.build(scanResult);

    const info = model.info as { projectName: string };
    info.projectName = 'mutated';

    expect(scanResult.info.projectName).toBe('Test Project');
  });

  it('should not allow modifying the root node type', () => {
    const model = builder.build(createScanResult());
    const root = model.tree.root();

    expect(root.type).toBe(ProjectNodeType.PROJECT);
  });

  // ── events (definitions only) ────────────────────────────────

  it('should define project model event names', () => {
    expect(ProjectModelEvents.MODEL_CREATED).toBe('project.model.created');
    expect(ProjectModelEvents.MODEL_UPDATED).toBe('project.model.updated');
    expect(ProjectModelEvents.MODEL_REMOVED).toBe('project.model.removed');
  });
});
/**
 * MVP-EXEC-04A: Real Workspace Initialization
 *
 * Proves that Cupaw can correctly establish:
 *
 *   Real Project Directory
 *        ↓
 *   Workspace
 *        ↓
 *   ProjectModel
 *        ↓
 *   SourceIndex
 *
 * The tests use an isolated fixture project and the existing
 * IFileSystem abstraction (VirtualFileSystem). No real repository
 * files are modified.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Workspace } from '../../src/workspace/Workspace.js';
import { VirtualFileSystem } from '../../src/filesystem/VirtualFileSystem.js';
import { ProjectScanner } from '../../src/project/ProjectScanner.js';
import { ProjectModelBuilder } from '../../src/model/ProjectModelBuilder.js';
import { SourceIndex } from '../../src/source/SourceIndex.js';
import { ProjectRootNotFoundError } from '../../src/project/ProjectScannerError.js';
import { WorkspaceNotOpenError } from '../../src/project/ProjectScannerError.js';
import { ProjectNodeType } from '../../src/model/ProjectNodeType.js';
import { createCLIConfig } from '../../src/cli/CLIConfig.js';
import { Bootstrap } from '../../src/bootstrap/Bootstrap.js';
import { LogLevel } from '../../src/logging/LogLevel.js';

/**
 * Creates an isolated fixture project in the given virtual file system.
 *
 * The fixture is fully isolated from the real Cupaw repository — it
 * exists only inside the in-memory VirtualFileSystem.
 */
function createFixtureProject(
  fs: VirtualFileSystem,
  rootPath: string,
): void {
  fs.createDirectory(rootPath);
  fs.createDirectory(`${rootPath}/src`);
  fs.writeFile(`${rootPath}/src/Cart.ts`, [
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
  fs.writeFile(`${rootPath}/src/index.ts`, 'export * from "./Cart";\n');
  fs.writeFile(`${rootPath}/package.json`, '{"name":"fixture-project"}');
  fs.writeFile(`${rootPath}/tsconfig.json`, '{"compilerOptions":{"target":"es2020"}}');
}

/**
 * Creates an open workspace for the given root path.
 */
function createOpenWorkspace(
  fs: VirtualFileSystem,
  id: string,
  name: string,
  rootPath: string,
): Workspace {
  const workspace = new Workspace();
  workspace.create(id, name, rootPath);
  workspace.open();
  return workspace;
}

/**
 * Builds the full chain: Workspace → ProjectScanner → ProjectModel → SourceIndex.
 */
function buildFullChain(
  fs: VirtualFileSystem,
  workspace: Workspace,
): { model: ReturnType<ProjectModelBuilder['build']>; sourceIndex: SourceIndex } {
  const scanner = new ProjectScanner(fs);
  const scanResult = scanner.scan(workspace);
  const builder = new ProjectModelBuilder();
  const model = builder.build(scanResult);
  const sourceIndex = new SourceIndex();
  sourceIndex.build(model);
  return { model, sourceIndex };
}

describe('MVP-EXEC-04A: Real Workspace Initialization', () => {
  let fs: VirtualFileSystem;

  beforeEach(() => {
    fs = new VirtualFileSystem();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Test 1 — Workspace initialization ─────────────────────────
  it('Test 1: Workspace uses the exact project root', () => {
    const rootPath = '/fixture-project';
    createFixtureProject(fs, rootPath);

    const workspace = createOpenWorkspace(fs, 'fixture', 'Fixture Project', rootPath);

    expect(workspace.isOpen()).toBe(true);
    expect(workspace.getRoot()).toBe(rootPath);
    expect(workspace.getInfo().rootPath).toBe(rootPath);
    expect(workspace.getInfo().id).toBe('fixture');
    expect(workspace.getInfo().name).toBe('Fixture Project');
  });

  // ── Test 2 — ProjectModel ─────────────────────────────────────
  it('Test 2: Workspace produces a valid ProjectModel', () => {
    const rootPath = '/fixture-project';
    createFixtureProject(fs, rootPath);

    const workspace = createOpenWorkspace(fs, 'fixture', 'Fixture Project', rootPath);
    const { model } = buildFullChain(fs, workspace);

    // projectId exists
    expect(model.info.projectId).toBe('fixture');

    // rootPath is correct
    expect(model.info.rootPath).toBe(rootPath);

    // project tree exists
    expect(model.tree).toBeDefined();
    expect(model.tree.root()).toBeDefined();
    expect(model.tree.root().type).toBe(ProjectNodeType.PROJECT);

    // expected files are discovered
    const cartNode = model.tree.findByPath('src/Cart.ts');
    const indexNode = model.tree.findByPath('src/index.ts');
    expect(cartNode).toBeDefined();
    expect(cartNode!.type).toBe(ProjectNodeType.FILE);
    expect(indexNode).toBeDefined();
    expect(indexNode!.type).toBe(ProjectNodeType.FILE);

    // package.json and tsconfig.json are also discovered
    expect(model.tree.findByPath('package.json')).toBeDefined();
    expect(model.tree.findByPath('tsconfig.json')).toBeDefined();
  });

  // ── Test 3 — SourceIndex ──────────────────────────────────────
  it('Test 3: SourceIndex exposes src/Cart.ts and src/index.ts', () => {
    const rootPath = '/fixture-project';
    createFixtureProject(fs, rootPath);

    const workspace = createOpenWorkspace(fs, 'fixture', 'Fixture Project', rootPath);
    const { sourceIndex } = buildFullChain(fs, workspace);

    // Both files are available through SourceIndex
    expect(sourceIndex.contains('src/Cart.ts')).toBe(true);
    expect(sourceIndex.contains('src/index.ts')).toBe(true);

    const cartEntry = sourceIndex.getFile('src/Cart.ts');
    expect(cartEntry.projectId).toBe('fixture');
    expect(cartEntry.path).toBe('src/Cart.ts');
    expect(cartEntry.extension).toBe('.ts');

    const indexEntry = sourceIndex.getFile('src/index.ts');
    expect(indexEntry.projectId).toBe('fixture');
    expect(indexEntry.path).toBe('src/index.ts');
    expect(indexEntry.extension).toBe('.ts');

    // Total indexed files: Cart.ts, index.ts, package.json, tsconfig.json
    expect(sourceIndex.size()).toBe(4);
  });

  // ── Test 4 — No OS-root scanning ──────────────────────────────
  it('Test 4: Initializing the fixture does NOT make "/" the project root', () => {
    const rootPath = '/fixture-project';
    createFixtureProject(fs, rootPath);

    const workspace = createOpenWorkspace(fs, 'fixture', 'Fixture Project', rootPath);
    const { model } = buildFullChain(fs, workspace);

    // The configured root path must be the fixture, not the OS root.
    expect(workspace.getRoot()).toBe(rootPath);
    expect(model.info.rootPath).toBe(rootPath);
    expect(model.info.rootPath).not.toBe('/');

    // The scanner must not have scanned the OS root.
    const scanner = new ProjectScanner(fs);
    const scanResult = scanner.scan(workspace);
    expect(scanResult.info.rootPath).toBe(rootPath);
    expect(scanResult.info.rootPath).not.toBe('/');
  });

  // ── Test 5 — Project isolation ────────────────────────────────
  it('Test 5: Project A and Project B are isolated', () => {
    // Create project-A and project-B in the same virtual file system.
    const rootA = '/project-A';
    const rootB = '/project-B';
    fs.createDirectory(rootA);
    fs.createDirectory(rootB);
    fs.createDirectory(`${rootA}/src`);
    fs.createDirectory(`${rootB}/src`);
    fs.writeFile(`${rootA}/src/a.ts`, 'export const a = 1;');
    fs.writeFile(`${rootA}/src/onlyA.ts`, 'export const onlyA = "A";');
    fs.writeFile(`${rootB}/src/b.ts`, 'export const b = 2;');
    fs.writeFile(`${rootB}/src/onlyB.ts`, 'export const onlyB = "B";');

    // Initialize A.
    const workspaceA = createOpenWorkspace(fs, 'project-a', 'Project A', rootA);
    const chainA = buildFullChain(fs, workspaceA);

    // A can see A's files.
    expect(chainA.sourceIndex.contains('src/a.ts')).toBe(true);
    expect(chainA.sourceIndex.contains('src/onlyA.ts')).toBe(true);

    // A cannot see B's files.
    expect(chainA.sourceIndex.contains('src/b.ts')).toBe(false);
    expect(chainA.sourceIndex.contains('src/onlyB.ts')).toBe(false);

    // Initialize B.
    const workspaceB = createOpenWorkspace(fs, 'project-b', 'Project B', rootB);
    const chainB = buildFullChain(fs, workspaceB);

    // B can see B's files.
    expect(chainB.sourceIndex.contains('src/b.ts')).toBe(true);
    expect(chainB.sourceIndex.contains('src/onlyB.ts')).toBe(true);

    // B cannot see A's files.
    expect(chainB.sourceIndex.contains('src/a.ts')).toBe(false);
    expect(chainB.sourceIndex.contains('src/onlyA.ts')).toBe(false);

    // Project identities are distinct.
    expect(chainA.model.info.projectId).toBe('project-a');
    expect(chainB.model.info.projectId).toBe('project-b');
    expect(chainA.model.info.rootPath).toBe(rootA);
    expect(chainB.model.info.rootPath).toBe(rootB);
  });

  // ── Test 6 — Empty/invalid workspace ──────────────────────────
  it('Test 6: Invalid project root uses existing error semantics', () => {
    // Case 1: Root does not exist in the file system.
    const missingWorkspace = createOpenWorkspace(fs, 'missing', 'Missing', '/does-not-exist');
    const scanner = new ProjectScanner(fs);

    expect(() => scanner.scan(missingWorkspace)).toThrow(ProjectRootNotFoundError);

    // Case 2: Workspace is not open.
    const closedWorkspace = new Workspace();
    closedWorkspace.create('closed', 'Closed', '/fixture-project');

    expect(() => scanner.scan(closedWorkspace)).toThrow(WorkspaceNotOpenError);

    // Case 3: Workspace creation rejects an empty root path.
    const emptyRootWorkspace = new Workspace();
    expect(() => emptyRootWorkspace.create('empty', 'Empty', '')).toThrow(
      'Workspace rootPath must not be empty.',
    );
  });

  // ── CLI integration: createCLIConfig with explicit projectRoot ─
  it('createCLIConfig accepts an explicit projectRoot', () => {
    const rootPath = '/fixture-project';
    createFixtureProject(fs, rootPath);

    const bootstrap = new Bootstrap({ options: { logLevel: LogLevel.WARN } });
    const bootstrapResult = bootstrap.initialize();
    const config = createCLIConfig({
      configuration: bootstrapResult.configuration,
      logger: bootstrapResult.logger,
      eventBus: bootstrapResult.eventBus,
      container: bootstrapResult.container,
      projectRoot: rootPath,
    });

    expect(config.workspace.getRoot()).toBe(rootPath);
    expect(config.workspace.getRoot()).not.toBe('/');
    expect(config.workspace.isOpen()).toBe(true);
  });
});
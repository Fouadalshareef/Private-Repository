import type { IFileSystem } from '../filesystem/IFileSystem.js';
import type { IWorkspace } from '../workspace/IWorkspace.js';
import type { IProjectScanner } from './IProjectScanner.js';
import type { ProjectInfo } from './ProjectInfo.js';
import type { ProjectFile } from './ProjectFile.js';
import type { ProjectDirectory } from './ProjectDirectory.js';
import type { ProjectStatistics } from './ProjectStatistics.js';
import type { ProjectScanResult } from './ProjectScanResult.js';
import type { ProjectScannerOptions } from './ProjectScannerOptions.js';
import {
  ProjectScannerError,
  WorkspaceNotOpenError,
  ProjectRootNotFoundError,
} from './ProjectScannerError.js';
import { extname } from '../filesystem/PathUtils.js';

/** Default options applied when no options are provided. */
const DEFAULT_OPTIONS: Required<ProjectScannerOptions> = {
  includeHidden: false,
  recursive: true,
  maxDepth: -1,
  ignoredExtensions: [],
  ignoredDirectories: [],
};

/**
 * Discovers and describes the structure of a software project.
 *
 * The scanner operates only through the {@link IFileSystem} abstraction
 * — it never accesses the operating system directly. It does not analyze
 * source code; it only discovers the project's structure.
 */
export class ProjectScanner implements IProjectScanner {
  private readonly fileSystemValue: IFileSystem;
  private info: ProjectInfo | undefined;
  private files: ProjectFile[] = [];
  private directories: ProjectDirectory[] = [];
  private rootPathValue: string | undefined;

  /**
   * Creates a new project scanner.
   * @param fileSystem The file system abstraction to scan with.
   */
  constructor(fileSystem: IFileSystem) {
    this.fileSystemValue = fileSystem;
  }

  /**
   * The file system used by the scanner.
   */
  public get fileSystem(): IFileSystem {
    return this.fileSystemValue;
  }

  /**
   * Scans the given workspace and stores the resulting project structure.
   *
   * @param workspace The workspace to scan.
   * @param options Optional scan options.
   * @returns The complete scan result.
   * @throws {ProjectScannerError} If the workspace is not open or the
   * project root does not exist.
   */
  public scan(workspace: IWorkspace, options?: ProjectScannerOptions): ProjectScanResult {
    if (!workspace.isOpen()) {
      throw new WorkspaceNotOpenError('Workspace must be open before it can be scanned.');
    }

    const rootPath = workspace.getRoot();
    if (!this.fileSystemValue.exists(rootPath)) {
      throw new ProjectRootNotFoundError(rootPath);
    }

    const resolvedOptions = this.resolveOptions(options);
    const scannedAt = Date.now();
    this.rootPathValue = rootPath;

    const resolveFiles: ProjectFile[] = [];
    const resolveDirectories: ProjectDirectory[] = [];
    const extensionCounts = new Map<string, number>();
    let totalSize = 0;

    this.scanDirectory(
      rootPath,
      0,
      resolvedOptions,
      resolveFiles,
      resolveDirectories,
      extensionCounts,
      (size) => {
        totalSize += size;
      },
    );

    const info: ProjectInfo = this.createProjectInfo(workspace, scannedAt);
    const statistics: ProjectStatistics = {
      totalFiles: resolveFiles.length,
      totalDirectories: resolveDirectories.length,
      totalSize,
      extensions: extensionCounts,
    };

    this.info = info;
    this.files = resolveFiles;
    this.directories = resolveDirectories;

    return { info, files: resolveFiles, directories: resolveDirectories, statistics };
  }

  /**
   * Returns the metadata of the last scanned project.
   *
   * @returns The project info.
   * @throws {ProjectScannerError} If no scan has been performed yet.
   */
  public getProjectInfo(): ProjectInfo {
    if (!this.info) {
      throw new ProjectScannerError('No project has been scanned yet.');
    }
    return { ...this.info };
  }

  /**
   * Returns all files discovered during the last scan.
   *
   * @returns The files.
   * @throws {ProjectScannerError} If no scan has been performed yet.
   */
  public getFiles(): readonly ProjectFile[] {
    if (!this.info) {
      throw new ProjectScannerError('No project has been scanned yet.');
    }
    return this.files.map((file) => ({ ...file }));
  }

  /**
   * Returns all directories discovered during the last scan.
   *
   * @returns The directories.
   * @throws {ProjectScannerError} If no scan has been performed yet.
   */
  public getDirectories(): readonly ProjectDirectory[] {
    if (!this.info) {
      throw new ProjectScannerError('No project has been scanned yet.');
    }
    return this.directories.map((dir) => ({ ...dir }));
  }

  /**
   * Returns aggregate statistics of the last scan.
   *
   * @returns The statistics.
   * @throws {ProjectScannerError} If no scan has been performed yet.
   */
  public getStatistics(): ProjectStatistics {
    if (!this.info) {
      throw new ProjectScannerError('No project has been scanned yet.');
    }
    return this.buildStatistics();
  }

  /**
   * Resolves scan options, applying defaults for any missing values.
   */
  private resolveOptions(options?: ProjectScannerOptions): Required<ProjectScannerOptions> {
    return {
      includeHidden: options?.includeHidden ?? DEFAULT_OPTIONS.includeHidden,
      recursive: options?.recursive ?? DEFAULT_OPTIONS.recursive,
      maxDepth: options?.maxDepth ?? DEFAULT_OPTIONS.maxDepth,
      ignoredExtensions: options?.ignoredExtensions ?? DEFAULT_OPTIONS.ignoredExtensions,
      ignoredDirectories: options?.ignoredDirectories ?? DEFAULT_OPTIONS.ignoredDirectories,
    };
  }

  /**
   * Recursively scans a directory, collecting files and subdirectories.
   */
  private scanDirectory(
    path: string,
    depth: number,
    options: Required<ProjectScannerOptions>,
    resolveFiles: ProjectFile[],
    resolveDirectories: ProjectDirectory[],
    extensionCounts: Map<string, number>,
    addSize: (size: number) => void,
  ): void {
    const entries = this.fileSystemValue.list(path);

    for (const entry of entries) {
      const name = entry.name;
      const isHidden = name.startsWith('.');
      if (isHidden && !options.includeHidden) {
        continue;
      }

      if (entry.isDirectory) {
        if (this.shouldIgnoreDirectory(name, options)) {
          continue;
        }
        const atMaxDepth = options.maxDepth >= 0 && depth >= options.maxDepth;
        if (atMaxDepth) {
          continue;
        }
        resolveDirectories.push({
          path: this.toRelativePath(entry.path),
          name,
          depth,
        });
        if (options.recursive) {
          this.scanDirectory(
            entry.path,
            depth + 1,
            options,
            resolveFiles,
            resolveDirectories,
            extensionCounts,
            addSize,
          );
        }
        continue;
      }

      // File entry.
      const extension = extname(name);
      if (this.shouldIgnoreExtension(extension, options)) {
        continue;
      }
      resolveFiles.push({
        path: this.toRelativePath(entry.path),
        name,
        extension,
        size: entry.size,
        createdAt: entry.createdAt,
        modifiedAt: entry.modifiedAt,
      });
      extensionCounts.set(extension, (extensionCounts.get(extension) ?? 0) + 1);
      addSize(entry.size);
    }
  }

  /**
   * Returns whether a directory should be ignored based on options.
   */
  private shouldIgnoreDirectory(
    name: string,
    options: Required<ProjectScannerOptions>,
  ): boolean {
    return options.ignoredDirectories.includes(name);
  }

  /**
   * Returns whether a file extension should be ignored based on options.
   */
  private shouldIgnoreExtension(
    extension: string,
    options: Required<ProjectScannerOptions>,
  ): boolean {
    return options.ignoredExtensions.includes(extension);
  }

  /**
   * Converts an absolute path to a path relative to the project root.
   */
  private toRelativePath(path: string): string {
    const root = this.rootPathValue ?? '';
    const normalizedRoot = root === '/' ? '/' : root + '/';
    if (path.startsWith(normalizedRoot)) {
      return path.substring(normalizedRoot.length);
    }
    return path;
  }

  /**
   * Creates the project info from the workspace and scan time.
   */
  private createProjectInfo(workspace: IWorkspace, scannedAt: number): ProjectInfo {
    const workspaceInfo = workspace.getInfo();
    return {
      projectId: workspaceInfo.id,
      projectName: workspaceInfo.name,
      rootPath: workspaceInfo.rootPath,
      createdAt: workspaceInfo.createdAt,
      scannedAt,
    };
  }

  /**
   * Builds statistics from the current files.
   */
  private buildStatistics(): ProjectStatistics {
    const extensionCounts = new Map<string, number>();
    let totalSize = 0;
    for (const file of this.files) {
      extensionCounts.set(file.extension, (extensionCounts.get(file.extension) ?? 0) + 1);
      totalSize += file.size;
    }
    return {
      totalFiles: this.files.length,
      totalDirectories: this.directories.length,
      totalSize,
      extensions: extensionCounts,
    };
  }
}
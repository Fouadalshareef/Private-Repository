import type { IFileSystem } from '../filesystem/IFileSystem.js';
import type { IWorkspace } from '../workspace/IWorkspace.js';
import type { ProjectInfo } from './ProjectInfo.js';
import type { ProjectFile } from './ProjectFile.js';
import type { ProjectDirectory } from './ProjectDirectory.js';
import type { ProjectStatistics } from './ProjectStatistics.js';
import type { ProjectScanResult } from './ProjectScanResult.js';
import type { ProjectScannerOptions } from './ProjectScannerOptions.js';

/**
 * Contract for the Project Scanner.
 *
 * The scanner discovers and describes the structure of a software
 * project. It operates only through the {@link IFileSystem} abstraction
 * — it never accesses the operating system directly.
 *
 * This version does NOT analyze source code; it only discovers the
 * project's structure.
 */
export interface IProjectScanner {
  /**
   * Scans the given workspace and stores the resulting project structure.
   *
   * @param workspace The workspace to scan.
   * @param options Optional scan options.
   * @returns The complete scan result.
   * @throws {ProjectScannerError} If the workspace is not open or the
   * project root does not exist.
   */
  scan(workspace: IWorkspace, options?: ProjectScannerOptions): ProjectScanResult;

  /**
   * Returns the metadata of the last scanned project.
   *
   * @returns The project info.
   * @throws {ProjectScannerError} If no scan has been performed yet.
   */
  getProjectInfo(): ProjectInfo;

  /**
   * Returns all files discovered during the last scan.
   *
   * @returns The files.
   * @throws {ProjectScannerError} If no scan has been performed yet.
   */
  getFiles(): readonly ProjectFile[];

  /**
   * Returns all directories discovered during the last scan.
   *
   * @returns The directories.
   * @throws {ProjectScannerError} If no scan has been performed yet.
   */
  getDirectories(): readonly ProjectDirectory[];

  /**
   * Returns aggregate statistics of the last scan.
   *
   * @returns The statistics.
   * @throws {ProjectScannerError} If no scan has been performed yet.
   */
  getStatistics(): ProjectStatistics;

  /**
   * The file system used by the scanner.
   */
  readonly fileSystem: IFileSystem;
}
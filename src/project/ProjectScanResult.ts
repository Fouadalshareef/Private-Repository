import type { ProjectInfo } from './ProjectInfo.js';
import type { ProjectFile } from './ProjectFile.js';
import type { ProjectDirectory } from './ProjectDirectory.js';
import type { ProjectStatistics } from './ProjectStatistics.js';

/**
 * The complete result of a project scan.
 */
export interface ProjectScanResult {
  /** Metadata about the scanned project. */
  readonly info: ProjectInfo;

  /** All files discovered during the scan. */
  readonly files: readonly ProjectFile[];

  /** All directories discovered during the scan. */
  readonly directories: readonly ProjectDirectory[];

  /** Aggregate statistics about the scanned project. */
  readonly statistics: ProjectStatistics;
}
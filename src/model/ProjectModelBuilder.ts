import type { ProjectScanResult } from '../project/ProjectScanResult.js';
import type { ProjectModel } from './ProjectModel.js';
import { ProjectTree } from './ProjectTree.js';
import type { ProjectNode } from './ProjectNode.js';
import { ProjectRootNode } from './ProjectRootNode.js';
import { ProjectFileNode } from './ProjectFileNode.js';
import { ProjectDirectoryNode } from './ProjectDirectoryNode.js';
import { ProjectModelError } from './ProjectModelError.js';
import { dirname } from '../filesystem/PathUtils.js';

/**
 * Builds a {@link ProjectModel} from a {@link ProjectScanResult}.
 *
 * The builder does NOT access the filesystem directly — it uses only
 * the scan result. It constructs the in-memory object graph of the
 * project.
 */
export class ProjectModelBuilder {
  /**
   * Builds a project model from a scan result.
   *
   * @param scanResult The scan result to build from.
   * @returns The built project model.
   * @throws {ProjectModelError} If the scan result is invalid.
   */
  public build(scanResult: ProjectScanResult): ProjectModel {
    const now = Date.now();

    // Create the root project node.
    const root = new ProjectRootNode(
      scanResult.info.projectId,
      scanResult.info.projectName,
      scanResult.info.createdAt,
    );

    // Track nodes by path for parent lookup.
    const nodesByPath = new Map<string, ProjectNode>();
    nodesByPath.set('', root);

    // Create directory nodes.
    for (const dir of scanResult.directories) {
      const node = new ProjectDirectoryNode(
        this.createDirectoryId(scanResult.info.projectId, dir.path),
        dir.name,
        dir.path,
        dir.depth,
        now,
      );
      nodesByPath.set(dir.path, node);
    }

    // Create file nodes.
    for (const file of scanResult.files) {
      const node = new ProjectFileNode(
        this.createFileId(scanResult.info.projectId, file.path),
        file.name,
        file.path,
        file.extension,
        file.size,
        file.createdAt,
        file.modifiedAt,
      );
      nodesByPath.set(file.path, node);
    }

    // Wire up parent/child relationships.
    for (const [path, node] of nodesByPath) {
      if (path === '') {
        continue;
      }
      const parentPath = dirname(path);
      const parent = nodesByPath.get(parentPath);
      if (!parent) {
        throw new ProjectModelError(
          `Cannot build model: parent not found for node "${path}" (parent: "${parentPath}").`,
        );
      }
      parent.addChild(node);
    }

    const tree = new ProjectTree(root);
    return {
      info: { ...scanResult.info },
      tree,
    };
  }

  /**
   * Creates a stable ID for a directory node.
   */
  private createDirectoryId(projectId: string, path: string): string {
    return `${projectId}:dir:${path}`;
  }

  /**
   * Creates a stable ID for a file node.
   */
  private createFileId(projectId: string, path: string): string {
    return `${projectId}:file:${path}`;
  }
}
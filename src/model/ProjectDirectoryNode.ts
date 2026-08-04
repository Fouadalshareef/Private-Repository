import { ProjectNode } from './ProjectNode.js';
import { ProjectNodeType } from './ProjectNodeType.js';

/**
 * A directory node in the Project Object Model.
 */
export class ProjectDirectoryNode extends ProjectNode {
  /** The type of the node. */
  public readonly type: ProjectNodeType = ProjectNodeType.DIRECTORY;

  /** The depth of the directory relative to the project root (root is depth 0). */
  public readonly depth: number;

  /**
   * Creates a new directory node.
   * @param id The unique identifier of the node.
   * @param name The name of the directory.
   * @param path The path of the directory relative to the project root.
   * @param depth The depth of the directory.
   * @param createdAt The timestamp when the directory was created.
   */
  constructor(id: string, name: string, path: string, depth: number, createdAt: number) {
    super(id, name, path, createdAt);
    this.depth = depth;
  }
}
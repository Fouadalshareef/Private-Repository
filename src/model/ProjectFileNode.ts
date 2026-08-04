import { ProjectNode } from './ProjectNode.js';
import { ProjectNodeType } from './ProjectNodeType.js';

/**
 * A file node in the Project Object Model.
 */
export class ProjectFileNode extends ProjectNode {
  /** The type of the node. */
  public readonly type: ProjectNodeType = ProjectNodeType.FILE;

  /** The extension of the file, including the leading dot (e.g., `.ts`). */
  public readonly extension: string;

  /** The size of the file in bytes. */
  public readonly size: number;

  /** The timestamp when the file was last modified. */
  public readonly modifiedAt: number;

  /**
   * Creates a new file node.
   * @param id The unique identifier of the node.
   * @param name The name of the file.
   * @param path The path of the file relative to the project root.
   * @param extension The extension of the file.
   * @param size The size of the file in bytes.
   * @param createdAt The timestamp when the file was created.
   * @param modifiedAt The timestamp when the file was last modified.
   */
  constructor(
    id: string,
    name: string,
    path: string,
    extension: string,
    size: number,
    createdAt: number,
    modifiedAt: number,
  ) {
    super(id, name, path, createdAt);
    this.extension = extension;
    this.size = size;
    this.modifiedAt = modifiedAt;
  }
}
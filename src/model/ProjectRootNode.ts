import { ProjectNode } from './ProjectNode.js';
import { ProjectNodeType } from './ProjectNodeType.js';

/**
 * The root node of a project in the Project Object Model.
 */
export class ProjectRootNode extends ProjectNode {
  /** The type of the node. */
  public readonly type: ProjectNodeType = ProjectNodeType.PROJECT;

  /**
   * Creates a new project root node.
   * @param id The unique identifier of the project.
   * @param name The name of the project.
   * @param createdAt The timestamp when the project was created.
   */
  constructor(id: string, name: string, createdAt: number) {
    super(id, name, '', createdAt);
  }
}
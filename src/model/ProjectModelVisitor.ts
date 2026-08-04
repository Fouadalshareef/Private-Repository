import type { ProjectNode } from './ProjectNode.js';
import type { ProjectFileNode } from './ProjectFileNode.js';
import type { ProjectDirectoryNode } from './ProjectDirectoryNode.js';

/**
 * Strongly typed visitor for traversing the Project Object Model tree.
 *
 * Implementations can override any of the visit methods. No business
 * logic is included — this is purely a traversal contract.
 */
export interface ProjectModelVisitor {
  /**
   * Called when visiting a project root node.
   * @param node The project root node.
   */
  visitProject?(node: ProjectNode): void;

  /**
   * Called when visiting a directory node.
   * @param node The directory node.
   */
  visitDirectory?(node: ProjectDirectoryNode): void;

  /**
   * Called when visiting a file node.
   * @param node The file node.
   */
  visitFile?(node: ProjectFileNode): void;

  /**
   * Called for every node during traversal, regardless of type.
   * @param node The node being visited.
   */
  visitNode?(node: ProjectNode): void;
}
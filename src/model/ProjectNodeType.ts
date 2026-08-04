/**
 * Defines the types of nodes in the Project Object Model.
 *
 * - `project`: The root node representing the entire project.
 * - `directory`: A directory node.
 * - `file`: A file node.
 */
export enum ProjectNodeType {
  PROJECT = 'project',
  DIRECTORY = 'directory',
  FILE = 'file',
}
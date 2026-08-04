import type { ProjectNode } from './ProjectNode.js';
import type { ProjectFileNode } from './ProjectFileNode.js';
import type { ProjectDirectoryNode } from './ProjectDirectoryNode.js';
import type { ProjectModelVisitor } from './ProjectModelVisitor.js';
import { ProjectNodeType } from './ProjectNodeType.js';

/**
 * Represents the tree structure of a project.
 *
 * Provides tree traversal and lookup operations over the project nodes.
 */
export class ProjectTree {
  private readonly rootNode: ProjectNode;

  /**
   * Creates a new project tree.
   * @param root The root node of the tree.
   */
  constructor(root: ProjectNode) {
    this.rootNode = root;
  }

  /**
   * Returns the root node of the tree.
   */
  public root(): ProjectNode {
    return this.rootNode;
  }

  /**
   * Finds a node by its path.
   *
   * @param path The path of the node.
   * @returns The node, or `undefined` if not found.
   */
  public findByPath(path: string): ProjectNode | undefined {
    return this.find((node) => node.path === path);
  }

  /**
   * Finds a node by its ID.
   *
   * @param id The ID of the node.
   * @returns The node, or `undefined` if not found.
   */
  public findById(id: string): ProjectNode | undefined {
    return this.find((node) => node.id === id);
  }

  /**
   * Finds the first node matching the given predicate.
   *
   * @param predicate The predicate to match.
   * @returns The first matching node, or `undefined`.
   */
  public find(predicate: (node: ProjectNode) => boolean): ProjectNode | undefined {
    let result: ProjectNode | undefined;
    this.walk((node) => {
      if (!result && predicate(node)) {
        result = node;
      }
    });
    return result;
  }

  /**
   * Returns whether the tree contains a node matching the given predicate.
   *
   * @param predicate The predicate to match.
   * @returns `true` if a matching node exists, `false` otherwise.
   */
  public contains(predicate: (node: ProjectNode) => boolean): boolean {
    return this.find(predicate) !== undefined;
  }

  /**
   * Walks the tree in depth-first pre-order, invoking the callback
   * for each node.
   *
   * @param callback The callback to invoke for each node.
   */
  public walk(callback: (node: ProjectNode) => void): void {
    this.walkNode(this.rootNode, callback);
  }

  /**
   * Visits the tree using a strongly typed visitor.
   *
   * @param visitor The visitor to use.
   */
  public visit(visitor: ProjectModelVisitor): void {
    this.visitNode(this.rootNode, visitor);
  }

  /**
   * Recursively walks a node and its descendants.
   */
  private walkNode(node: ProjectNode, callback: (node: ProjectNode) => void): void {
    callback(node);
    for (const child of node.children) {
      this.walkNode(child, callback);
    }
  }

  /**
   * Recursively visits a node and its descendants using the visitor.
   */
  private visitNode(node: ProjectNode, visitor: ProjectModelVisitor): void {
    visitor.visitNode?.(node);
    switch (node.type) {
      case ProjectNodeType.PROJECT:
        visitor.visitProject?.(node);
        break;
      case ProjectNodeType.DIRECTORY:
        visitor.visitDirectory?.(node as ProjectDirectoryNode);
        break;
      case ProjectNodeType.FILE:
        visitor.visitFile?.(node as ProjectFileNode);
        break;
    }
    for (const child of node.children) {
      this.visitNode(child, visitor);
    }
  }
}
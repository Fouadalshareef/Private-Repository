import type { ProjectNodeType } from './ProjectNodeType.js';

/**
 * Base class for all nodes in the Project Object Model.
 *
 * A node represents an element of the project tree (project root,
 * directory, or file). Nodes form a tree via parent/children links.
 */
export abstract class ProjectNode {
  /** The unique identifier of the node. */
  public readonly id: string;

  /** The name of the node. */
  public readonly name: string;

  /** The path of the node relative to the project root. */
  public readonly path: string;

  /** The type of the node. */
  public abstract readonly type: ProjectNodeType;

  /** The parent node, or `undefined` for the root. */
  public parent: ProjectNode | undefined;

  /** The child nodes. */
  public readonly children: ProjectNode[];

  /** The timestamp when the node was created. */
  public readonly createdAt: number;

  /**
   * Creates a new project node.
   * @param id The unique identifier of the node.
   * @param name The name of the node.
   * @param path The path of the node relative to the project root.
   * @param createdAt The timestamp when the node was created.
   */
  constructor(id: string, name: string, path: string, createdAt: number) {
    this.id = id;
    this.name = name;
    this.path = path;
    this.createdAt = createdAt;
    this.parent = undefined;
    this.children = [];
  }

  /**
   * Returns whether this node is the root of the tree.
   */
  public isRoot(): boolean {
    return this.parent === undefined;
  }

  /**
   * Returns whether this node has children.
   */
  public hasChildren(): boolean {
    return this.children.length > 0;
  }

  /**
   * Adds a child node to this node.
   * @param child The child node to add.
   */
  public addChild(child: ProjectNode): void {
    child.parent = this;
    this.children.push(child);
  }
}
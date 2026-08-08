import { TaskStatus, type TaskNode, type TaskTree as TaskTreeType, PlanningError } from './types.js';

export { TaskStatus } from './types.js';

/**
 * Immutable task tree data structure.
 *
 * Represents a plan as a flat node collection with explicit dependency
 * edges. Supports both strict trees and general DAGs.
 */
export class TaskTree implements TaskTreeType {
  constructor(
    public readonly rootId: string,
    public readonly nodes: readonly TaskNode[],
  ) {}

  /**
   * Returns the nodes of the tree.
   */
  public getNodes(): readonly TaskNode[] {
    return this.nodes;
  }
}

/**
 * Manages a task tree: validates structure, performs dependency-aware
 * topological ordering, and provides node lookup / status updates.
 */
export class TaskTreeManager {
  private readonly nodeMap: Map<string, TaskNode>;

  constructor(private readonly tree: TaskTreeType) {
    this.nodeMap = new Map(tree.nodes.map((n) => [n.id, n]));
  }

  /**
   * Returns the underlying task tree.
   */
  public getTree(): TaskTreeType {
    return this.tree;
  }

  /**
   * Returns a node by id, or undefined if not found.
   */
  public getNodeById(id: string): TaskNode | undefined {
    return this.nodeMap.get(id);
  }

  /**
   * Updates the status of a node.
   */
  public updateNodeStatus(id: string, status: TaskStatus): void {
    const node = this.nodeMap.get(id);
    if (!node) {
      throw new PlanningError(`Task node not found: ${id}`);
    }
    node.status = status;
  }

  /**
   * Validates the task tree structure.
   *
   * Detects:
   * - duplicate node IDs
   * - missing dependencies (deps referencing unknown nodes)
   * - self-dependencies
   * - dependency cycles
   * - invalid required fields (empty id/description)
   *
   * @throws {@link PlanningError} if the tree is invalid.
   */
  public validate(): void {
    const ids = new Set<string>();

    for (const node of this.tree.nodes) {
      if (!node.id || node.id.trim().length === 0) {
        throw new PlanningError('Task node has an empty id');
      }
      if (!node.description || node.description.trim().length === 0) {
        throw new PlanningError(`Task node '${node.id}' has an empty description`);
      }
      if (ids.has(node.id)) {
        throw new PlanningError(`Duplicate task node id: ${node.id}`);
      }
      ids.add(node.id);

      for (const depId of node.dependencies) {
        if (depId === node.id) {
          throw new PlanningError(`Task node '${node.id}' depends on itself`);
        }
        if (!this.nodeMap.has(depId)) {
          throw new PlanningError(`Task node '${node.id}' depends on missing node '${depId}'`);
        }
      }
    }

    if (!this.nodeMap.has(this.tree.rootId)) {
      throw new PlanningError(`Task tree root '${this.tree.rootId}' does not exist`);
    }

    this.detectCycles();
  }

  /**
   * Returns nodes in dependency order (topological sort).
   *
   * A node appears after all of its dependencies. Throws
   * {@link PlanningError} if the graph contains a cycle.
   */
  public topologicalOrder(): readonly TaskNode[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: TaskNode[] = [];

    const visit = (nodeId: string): void => {
      if (visited.has(nodeId)) {
        return;
      }
      if (visiting.has(nodeId)) {
        throw new PlanningError(`Dependency cycle detected at node '${nodeId}'`);
      }
      visiting.add(nodeId);

      const node = this.nodeMap.get(nodeId);
      if (!node) {
        throw new PlanningError(`Task node not found: ${nodeId}`);
      }

      for (const depId of node.dependencies) {
        visit(depId);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      order.push(node);
    };

    for (const node of this.tree.nodes) {
      visit(node.id);
    }

    return order;
  }

  /**
   * Detects dependency cycles using DFS.
   *
   * @throws {@link PlanningError} if a cycle is found.
   */
  private detectCycles(): void {
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (nodeId: string): void => {
      if (visited.has(nodeId)) {
        return;
      }
      if (visiting.has(nodeId)) {
        throw new PlanningError(`Dependency cycle detected at node '${nodeId}'`);
      }
      visiting.add(nodeId);

      const node = this.nodeMap.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          visit(depId);
        }
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
    };

    for (const node of this.tree.nodes) {
      visit(node.id);
    }
  }
}

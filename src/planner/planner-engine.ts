import {
  TaskStatus,
  type TaskNode,
  type TaskTree,
  type Planner,
  type PlannerResult,
  PlanningError,
} from './types.js';
import { TaskTreeManager } from './task-tree.js';

/**
 * Deterministic Planner implementation.
 *
 * Produces a task tree from a natural-language goal. The current planning
 * strategy is intentionally simple and deterministic (a single root node)
 * so that it can be unit-tested without an external LLM. The structure
 * supports expansion to multi-node DAG planning in the future.
 */
export class PlannerEngine implements Planner {
  private readonly nodes: Map<string, TaskNode> = new Map();
  private taskTree: TaskTree | undefined;

  /**
   * Generates a task tree from a natural-language goal.
   *
   * The current implementation produces a single root node. This is a
   * deterministic baseline that preserves extensibility toward multi-node
   * planning (a future PlannerProvider can decompose the goal further).
   */
  public async planTask(goal: string): Promise<TaskTree> {
    if (!goal || goal.trim().length === 0) {
      throw new PlanningError('Cannot plan an empty goal');
    }

    const rootId = `task-${Date.now()}`;
    const rootNode: TaskNode = {
      id: rootId,
      description: goal.trim(),
      status: TaskStatus.Pending,
      dependencies: [],
    };

    this.nodes.clear();
    this.nodes.set(rootId, rootNode);

    this.taskTree = {
      rootId,
      nodes: [rootNode],
    };

    return this.taskTree;
  }

  /**
   * Validates a task tree before execution.
   *
   * @throws {@link PlanningError} if the tree is invalid.
   */
  public validateTaskTree(tree: TaskTree): void {
    const manager = new TaskTreeManager(tree);
    manager.validate();
  }

  /**
   * Returns a node by id, or undefined if not found.
   */
  public getNodeById(taskId: string): TaskNode | undefined {
    return this.nodes.get(taskId);
  }

  /**
   * Updates the status of a node.
   */
  public updateNodeStatus(taskId: string, status: TaskStatus): void {
    const node = this.nodes.get(taskId);
    if (!node) {
      throw new PlanningError(`Task node not found: ${taskId}`);
    }
    node.status = status;
  }

  /**
   * Executes a task tree in dependency order.
   *
   * Each node is executed by the agent assigned to it (via the provided
   * executor callback). If a node fails, its dependent nodes are marked
   * {@link TaskStatus.Blocked}.
   *
   * @param tree The task tree to execute.
   * @param executeNode A callback that executes a single node and returns
   *   its output. The callback must throw on failure.
   */
  public async executePlan(
    tree: TaskTree,
    executeNode: (node: TaskNode) => Promise<unknown>,
  ): Promise<PlannerResult> {
    this.validateTaskTree(tree);

    const manager = new TaskTreeManager(tree);
    const orderedNodes = manager.topologicalOrder();

    const startTime = Date.now();
    const completedTaskIds: string[] = [];
    const failedTaskIds: string[] = [];
    const errors: string[] = [];

    for (const node of orderedNodes) {
      if (node.status !== TaskStatus.Pending) {
        continue;
      }

      // Check dependencies: all must be Completed.
      const dependenciesMet = node.dependencies.every((depId) => {
        const dependency = manager.getNodeById(depId);
        return dependency?.status === TaskStatus.Completed;
      });

      if (!dependenciesMet) {
        // If any dependency failed, this node is blocked.
        const hasFailedDep = node.dependencies.some((depId) => {
          const dep = manager.getNodeById(depId);
          return dep?.status === TaskStatus.Failed;
        });
        if (hasFailedDep) {
          node.status = TaskStatus.Blocked;
        }
        continue;
      }

      node.status = TaskStatus.InProgress;
      try {
        const output = await executeNode(node);
        node.result = output;
        node.status = TaskStatus.Completed;
        completedTaskIds.push(node.id);
      } catch (error) {
        node.status = TaskStatus.Failed;
        node.error = error instanceof Error ? error.message : String(error);
        failedTaskIds.push(node.id);
        errors.push(node.error);
        // Mark all downstream dependents as blocked.
        this.markDependentsBlocked(manager, node.id);
      }
    }

    return {
      rootId: tree.rootId,
      status: failedTaskIds.length > 0 ? 'failed' : 'completed',
      completedTaskIds,
      failedTaskIds,
      durationMs: Date.now() - startTime,
      errors,
      taskTree: tree,
    };
  }

  /**
   * Marks all nodes that (transitively) depend on the given node as blocked.
   */
  private markDependentsBlocked(manager: TaskTreeManager, failedNodeId: string): void {
    for (const node of manager.getTree().nodes) {
      if (node.status === TaskStatus.Pending && node.dependencies.includes(failedNodeId)) {
        node.status = TaskStatus.Blocked;
      }
    }
  }
}

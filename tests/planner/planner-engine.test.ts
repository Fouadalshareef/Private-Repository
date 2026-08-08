import { describe, it, expect } from 'vitest';
import { PlannerEngine } from '../../src/planner/planner-engine.js';
import { TaskTree } from '../../src/planner/task-tree.js';
import { TaskStatus, type TaskNode, PlanningError } from '../../src/planner/types.js';

function makeNode(id: string, description: string, dependencies: readonly string[] = []): TaskNode {
  return {
    id,
    description,
    status: TaskStatus.Pending,
    dependencies,
  };
}

describe('PlannerEngine', () => {
  it('constructs successfully', () => {
    const planner = new PlannerEngine();
    expect(planner).toBeInstanceOf(PlannerEngine);
  });

  it('plans a task and produces a valid task tree', async () => {
    const planner = new PlannerEngine();
    const tree = await planner.planTask('Build a feature');

    expect(tree.rootId).toBeDefined();
    expect(tree.nodes).toHaveLength(1);
    expect(tree.nodes[0].description).toBe('Build a feature');
    expect(tree.nodes[0].status).toBe(TaskStatus.Pending);
  });

  it('rejects empty goal', async () => {
    const planner = new PlannerEngine();
    await expect(planner.planTask('')).rejects.toThrow(PlanningError);
    await expect(planner.planTask('   ')).rejects.toThrow(PlanningError);
  });

  it('validates a valid task tree', () => {
    const planner = new PlannerEngine();
    const nodeA = makeNode('a', 'Task A');
    const nodeB = makeNode('b', 'Task B', ['a']);
    const tree = new TaskTree('a', [nodeA, nodeB]);

    expect(() => planner.validateTaskTree(tree)).not.toThrow();
  });

  it('rejects an invalid task tree', () => {
    const planner = new PlannerEngine();
    const nodeA = makeNode('a', 'Task A', ['missing']);
    const tree = new TaskTree('a', [nodeA]);

    expect(() => planner.validateTaskTree(tree)).toThrow(PlanningError);
  });

  it('looks up a node by id', async () => {
    const planner = new PlannerEngine();
    const tree = await planner.planTask('Build a feature');

    const node = planner.getNodeById(tree.rootId);
    expect(node).toBeDefined();
    expect(node?.description).toBe('Build a feature');
    expect(planner.getNodeById('missing')).toBeUndefined();
  });

  it('updates node status', async () => {
    const planner = new PlannerEngine();
    const tree = await planner.planTask('Build a feature');

    planner.updateNodeStatus(tree.rootId, TaskStatus.Completed);
    expect(planner.getNodeById(tree.rootId)?.status).toBe(TaskStatus.Completed);
  });

  it('throws when updating a missing node', async () => {
    const planner = new PlannerEngine();
    await planner.planTask('Build a feature');

    expect(() => planner.updateNodeStatus('missing', TaskStatus.Completed)).toThrow(PlanningError);
  });

  it('executes a plan successfully', async () => {
    const planner = new PlannerEngine();
    const nodeA = makeNode('a', 'Task A');
    const nodeB = makeNode('b', 'Task B', ['a']);
    const tree = new TaskTree('a', [nodeA, nodeB]);

    const executed: string[] = [];
    const result = await planner.executePlan(tree, async (node) => {
      executed.push(node.id);
      return `output-${node.id}`;
    });

    expect(result.status).toBe('completed');
    expect(result.completedTaskIds).toEqual(['a', 'b']);
    expect(result.failedTaskIds).toEqual([]);
    expect(executed).toEqual(['a', 'b']);
    expect(nodeA.status).toBe(TaskStatus.Completed);
    expect(nodeB.status).toBe(TaskStatus.Completed);
    expect(nodeA.result).toBe('output-a');
    expect(nodeB.result).toBe('output-b');
  });

  it('handles node failure and blocks dependents', async () => {
    const planner = new PlannerEngine();
    const nodeA = makeNode('a', 'Task A');
    const nodeB = makeNode('b', 'Task B', ['a']);
    const nodeC = makeNode('c', 'Task C', ['b']);
    const tree = new TaskTree('a', [nodeA, nodeB, nodeC]);

    const result = await planner.executePlan(tree, async (node) => {
      if (node.id === 'b') {
        throw new Error('Task B failed');
      }
      return `output-${node.id}`;
    });

    expect(result.status).toBe('failed');
    expect(result.completedTaskIds).toEqual(['a']);
    expect(result.failedTaskIds).toEqual(['b']);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBe('Task B failed');
    expect(nodeA.status).toBe(TaskStatus.Completed);
    expect(nodeB.status).toBe(TaskStatus.Failed);
    expect(nodeC.status).toBe(TaskStatus.Blocked);
  });

  it('respects dependency ordering', async () => {
    const planner = new PlannerEngine();
    const nodeA = makeNode('a', 'Task A');
    const nodeB = makeNode('b', 'Task B', ['a']);
    const nodeC = makeNode('c', 'Task C', ['b']);
    const tree = new TaskTree('a', [nodeA, nodeB, nodeC]);

    const executed: string[] = [];
    await planner.executePlan(tree, async (node) => {
      executed.push(node.id);
      return `output-${node.id}`;
    });

    expect(executed).toEqual(['a', 'b', 'c']);
  });

  it('marks dependents as blocked when a dependency already failed', async () => {
    const planner = new PlannerEngine();
    const nodeA = makeNode('a', 'Task A');
    const nodeB = makeNode('b', 'Task B', ['a']);
    const tree = new TaskTree('a', [nodeA, nodeB]);

    // Mark A as failed before execution
    nodeA.status = TaskStatus.Failed;

    const executed: string[] = [];
    const result = await planner.executePlan(tree, async (node) => {
      executed.push(node.id);
      return `output-${node.id}`;
    });

    expect(executed).toEqual([]);
    expect(result.status).toBe('failed');
    expect(result.failedTaskIds).toEqual(['a']);
    expect(nodeB.status).toBe(TaskStatus.Blocked);
  });

  it('blocks transitive dependents when a node fails', async () => {
    const planner = new PlannerEngine();
    const nodeA = makeNode('a', 'Task A');
    const nodeB = makeNode('b', 'Task B', ['a']);
    const nodeC = makeNode('c', 'Task C', ['b']);
    const tree = new TaskTree('a', [nodeA, nodeB, nodeC]);

    const result = await planner.executePlan(tree, async (node) => {
      if (node.id === 'a') {
        throw new Error('Task A failed');
      }
      return `output-${node.id}`;
    });

    expect(result.status).toBe('failed');
    expect(result.completedTaskIds).toEqual([]);
    expect(result.failedTaskIds).toEqual(['a']);
    expect(nodeA.status).toBe(TaskStatus.Failed);
    expect(nodeB.status).toBe(TaskStatus.Blocked);
    expect(nodeC.status).toBe(TaskStatus.Blocked);
  });

  it('does not execute a node with a blocked dependency', async () => {
    const planner = new PlannerEngine();
    const nodeA = makeNode('a', 'Task A');
    const nodeB = makeNode('b', 'Task B', ['a']);
    const nodeC = makeNode('c', 'Task C', ['b']);
    const tree = new TaskTree('a', [nodeA, nodeB, nodeC]);

    // Mark A as failed before execution
    nodeA.status = TaskStatus.Failed;

    const executed: string[] = [];
    const result = await planner.executePlan(tree, async (node) => {
      executed.push(node.id);
      return `output-${node.id}`;
    });

    expect(executed).toEqual([]);
    expect(result.status).toBe('failed');
    expect(nodeB.status).toBe(TaskStatus.Blocked);
    expect(nodeC.status).toBe(TaskStatus.Blocked);
  });

  it('continues independent branches when one branch fails', async () => {
    const planner = new PlannerEngine();
    const nodeA = makeNode('a', 'Task A');
    const nodeB = makeNode('b', 'Task B', ['a']);
    const nodeC = makeNode('c', 'Task C');
    const tree = new TaskTree('a', [nodeA, nodeB, nodeC]);

    const result = await planner.executePlan(tree, async (node) => {
      if (node.id === 'a') {
        throw new Error('Task A failed');
      }
      return `output-${node.id}`;
    });

    expect(result.status).toBe('failed');
    expect(result.completedTaskIds).toEqual(['c']);
    expect(result.failedTaskIds).toEqual(['a']);
    expect(nodeA.status).toBe(TaskStatus.Failed);
    expect(nodeB.status).toBe(TaskStatus.Blocked);
    expect(nodeC.status).toBe(TaskStatus.Completed);
  });
});

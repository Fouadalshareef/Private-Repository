import { describe, it, expect } from 'vitest';
import { TaskTree, TaskTreeManager } from '../../src/planner/task-tree.js';
import { TaskStatus, type TaskNode, PlanningError } from '../../src/planner/types.js';

function makeNode(id: string, description: string, dependencies: readonly string[] = []): TaskNode {
  return {
    id,
    description,
    status: TaskStatus.Pending,
    dependencies,
  };
}

describe('TaskTree', () => {
  it('stores rootId and nodes', () => {
    const node = makeNode('a', 'Task A');
    const tree = new TaskTree('a', [node]);
    expect(tree.rootId).toBe('a');
    expect(tree.getNodes()).toHaveLength(1);
    expect(tree.getNodes()[0]).toBe(node);
  });
});

describe('TaskTreeManager', () => {
  it('returns a node by id', () => {
    const nodeA = makeNode('a', 'Task A');
    const nodeB = makeNode('b', 'Task B', ['a']);
    const manager = new TaskTreeManager(new TaskTree('a', [nodeA, nodeB]));

    expect(manager.getNodeById('a')).toBe(nodeA);
    expect(manager.getNodeById('b')).toBe(nodeB);
    expect(manager.getNodeById('missing')).toBeUndefined();
  });

  it('updates node status', () => {
    const nodeA = makeNode('a', 'Task A');
    const manager = new TaskTreeManager(new TaskTree('a', [nodeA]));

    manager.updateNodeStatus('a', TaskStatus.Completed);
    expect(nodeA.status).toBe(TaskStatus.Completed);
  });

  it('throws when updating a missing node', () => {
    const nodeA = makeNode('a', 'Task A');
    const manager = new TaskTreeManager(new TaskTree('a', [nodeA]));

    expect(() => manager.updateNodeStatus('missing', TaskStatus.Completed)).toThrow(PlanningError);
  });

  it('validates a valid tree', () => {
    const nodeA = makeNode('a', 'Task A');
    const nodeB = makeNode('b', 'Task B', ['a']);
    const manager = new TaskTreeManager(new TaskTree('a', [nodeA, nodeB]));

    expect(() => manager.validate()).not.toThrow();
  });

  it('rejects duplicate node IDs', () => {
    const nodeA = makeNode('a', 'Task A');
    const nodeA2 = makeNode('a', 'Task A duplicate');
    const manager = new TaskTreeManager(new TaskTree('a', [nodeA, nodeA2]));

    expect(() => manager.validate()).toThrow(PlanningError);
  });

  it('rejects missing dependencies', () => {
    const nodeA = makeNode('a', 'Task A', ['missing']);
    const manager = new TaskTreeManager(new TaskTree('a', [nodeA]));

    expect(() => manager.validate()).toThrow(PlanningError);
  });

  it('rejects self-dependencies', () => {
    const nodeA = makeNode('a', 'Task A', ['a']);
    const manager = new TaskTreeManager(new TaskTree('a', [nodeA]));

    expect(() => manager.validate()).toThrow(PlanningError);
  });

  it('rejects dependency cycles', () => {
    const nodeA = makeNode('a', 'Task A', ['b']);
    const nodeB = makeNode('b', 'Task B', ['a']);
    const manager = new TaskTreeManager(new TaskTree('a', [nodeA, nodeB]));

    expect(() => manager.validate()).toThrow(PlanningError);
  });

  it('rejects empty node id', () => {
    const nodeA = makeNode('', 'Task A');
    const manager = new TaskTreeManager(new TaskTree('', [nodeA]));

    expect(() => manager.validate()).toThrow(PlanningError);
  });

  it('rejects empty node description', () => {
    const nodeA = makeNode('a', '');
    const manager = new TaskTreeManager(new TaskTree('a', [nodeA]));

    expect(() => manager.validate()).toThrow(PlanningError);
  });

  it('rejects missing root node', () => {
    const nodeA = makeNode('a', 'Task A');
    const manager = new TaskTreeManager(new TaskTree('missing-root', [nodeA]));

    expect(() => manager.validate()).toThrow(PlanningError);
  });

  it('returns nodes in topological order', () => {
    const nodeA = makeNode('a', 'Task A');
    const nodeB = makeNode('b', 'Task B', ['a']);
    const nodeC = makeNode('c', 'Task C', ['b']);
    const manager = new TaskTreeManager(new TaskTree('a', [nodeA, nodeB, nodeC]));

    const order = manager.topologicalOrder();
    expect(order.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('throws on topological order with cycle', () => {
    const nodeA = makeNode('a', 'Task A', ['b']);
    const nodeB = makeNode('b', 'Task B', ['a']);
    const manager = new TaskTreeManager(new TaskTree('a', [nodeA, nodeB]));

    expect(() => manager.topologicalOrder()).toThrow(PlanningError);
  });
});

import { describe, it, expect } from 'vitest';
import { AgentRuntime } from '../../src/agent/agent-runtime.js';
import { PlannerEngine } from '../../src/planner/planner-engine.js';
import { TaskTree } from '../../src/planner/task-tree.js';
import { TaskStatus, type TaskNode, PlannerNotAttachedError } from '../../src/planner/types.js';

function makeNode(id: string, description: string, dependencies: readonly string[] = [], assignedAgent?: string): TaskNode {
  return {
    id,
    description,
    status: TaskStatus.Pending,
    dependencies,
    assignedAgent,
  };
}

describe('AgentRuntime Planner Integration', () => {
  it('throws PlannerNotAttachedError when no planner is attached', async () => {
    const runtime = new AgentRuntime();
    await expect(runtime.planTask('Build a feature')).rejects.toThrow(PlannerNotAttachedError);
  });

  it('plans a task through the attached planner', async () => {
    const runtime = new AgentRuntime({ planner: new PlannerEngine() });
    const tree = await runtime.planTask('Build a feature');

    expect(tree.rootId).toBeDefined();
    expect(tree.nodes).toHaveLength(1);
    expect(tree.nodes[0].description).toBe('Build a feature');
  });

  it('executes a plan through the runtime', async () => {
    const runtime = new AgentRuntime({ planner: new PlannerEngine() });
    runtime.createAgent({
      agentId: 'agent-1',
      handler: async (input) => ({ output: `done:${String(input)}` }),
    });

    const nodeA = makeNode('a', 'Task A', [], 'agent-1');
    const nodeB = makeNode('b', 'Task B', ['a'], 'agent-1');
    const tree = new TaskTree('a', [nodeA, nodeB]);

    const result = await runtime.executePlan(tree);

    expect(result.status).toBe('completed');
    expect(result.completedTaskIds).toEqual(['a', 'b']);
    expect(nodeA.status).toBe(TaskStatus.Completed);
    expect(nodeB.status).toBe(TaskStatus.Completed);
    expect(nodeA.result).toBe('done:Task A');
    expect(nodeB.result).toBe('done:Task B');
  });

  it('executes a single task node through the runtime', async () => {
    const runtime = new AgentRuntime({ planner: new PlannerEngine() });
    runtime.createAgent({
      agentId: 'agent-1',
      handler: async (input) => ({ output: `done:${String(input)}` }),
    });

    const nodeA = makeNode('a', 'Task A', [], 'agent-1');
    const tree = new TaskTree('a', [nodeA]);

    const result = await runtime.executeTaskNode('a', tree);

    expect(result.output).toBe('done:Task A');
    expect(nodeA.status).toBe(TaskStatus.Completed);
  });

  it('throws when executing a task node with unmet dependencies', async () => {
    const runtime = new AgentRuntime({ planner: new PlannerEngine() });
    runtime.createAgent({
      agentId: 'agent-1',
      handler: async (input) => ({ output: `done:${String(input)}` }),
    });

    const nodeA = makeNode('a', 'Task A', [], 'agent-1');
    const nodeB = makeNode('b', 'Task B', ['a'], 'agent-1');
    const tree = new TaskTree('a', [nodeA, nodeB]);

    await expect(runtime.executeTaskNode('b', tree)).rejects.toThrow(
      /Dependencies for task 'b' are not all completed/
    );
  });

  it('throws when executing a task node with no assigned agent', async () => {
    const runtime = new AgentRuntime({ planner: new PlannerEngine() });
    const nodeA = makeNode('a', 'Task A');
    const tree = new TaskTree('a', [nodeA]);

    await expect(runtime.executeTaskNode('a', tree)).rejects.toThrow(
      /missing an assigned agent/
    );
  });

  it('throws when executing a plan with a node missing an assigned agent', async () => {
    const runtime = new AgentRuntime({ planner: new PlannerEngine() });
    const nodeA = makeNode('a', 'Task A');
    const tree = new TaskTree('a', [nodeA]);

    await expect(runtime.executePlan(tree)).rejects.toThrow(
      /missing an assigned agent/
    );
  });

  it('throws when executing a plan with no planner attached', async () => {
    const runtime = new AgentRuntime();
    const nodeA = makeNode('a', 'Task A', [], 'agent-1');
    const tree = new TaskTree('a', [nodeA]);

    await expect(runtime.executePlan(tree)).rejects.toThrow(PlannerNotAttachedError);
  });

  it('throws when executing a task node with no planner attached', async () => {
    const runtime = new AgentRuntime();
    const nodeA = makeNode('a', 'Task A', [], 'agent-1');
    const tree = new TaskTree('a', [nodeA]);

    await expect(runtime.executeTaskNode('a', tree)).rejects.toThrow(PlannerNotAttachedError);
  });

  it('sets and gets the planner', () => {
    const runtime = new AgentRuntime();
    expect(runtime.getPlanner()).toBeUndefined();

    const planner = new PlannerEngine();
    runtime.setPlanner(planner);
    expect(runtime.getPlanner()).toBe(planner);
  });

  it('marks a node as failed and blocks dependents when an agent throws', async () => {
    const runtime = new AgentRuntime({ planner: new PlannerEngine() });
    runtime.createAgent({
      agentId: 'agent-1',
      handler: async (input) => {
        if (String(input) === 'Task B') {
          throw new Error('Task B failed');
        }
        return { output: `done:${String(input)}` };
      },
    });

    const nodeA = makeNode('a', 'Task A', [], 'agent-1');
    const nodeB = makeNode('b', 'Task B', ['a'], 'agent-1');
    const nodeC = makeNode('c', 'Task C', ['b'], 'agent-1');
    const tree = new TaskTree('a', [nodeA, nodeB, nodeC]);

    const result = await runtime.executePlan(tree);

    expect(result.status).toBe('failed');
    expect(result.completedTaskIds).toEqual(['a']);
    expect(result.failedTaskIds).toEqual(['b']);
    expect(result.errors).toEqual(['Task B failed']);
    expect(nodeA.status).toBe(TaskStatus.Completed);
    expect(nodeB.status).toBe(TaskStatus.Failed);
    expect(nodeB.error).toBe('Task B failed');
    expect(nodeC.status).toBe(TaskStatus.Blocked);
  });

  it('does not execute a node whose dependency is blocked', async () => {
    const runtime = new AgentRuntime({ planner: new PlannerEngine() });
    const executed: string[] = [];
    runtime.createAgent({
      agentId: 'agent-1',
      handler: async (input) => {
        executed.push(String(input));
        if (String(input) === 'Task A') {
          throw new Error('Task A failed');
        }
        return { output: `done:${String(input)}` };
      },
    });

    const nodeA = makeNode('a', 'Task A', [], 'agent-1');
    const nodeB = makeNode('b', 'Task B', ['a'], 'agent-1');
    const tree = new TaskTree('a', [nodeA, nodeB]);

    const result = await runtime.executePlan(tree);

    expect(executed).toEqual(['Task A']);
    expect(result.status).toBe('failed');
    expect(result.failedTaskIds).toEqual(['a']);
    expect(nodeA.status).toBe(TaskStatus.Failed);
    expect(nodeB.status).toBe(TaskStatus.Blocked);
  });

  it('continues independent branches when one branch fails', async () => {
    const runtime = new AgentRuntime({ planner: new PlannerEngine() });
    runtime.createAgent({
      agentId: 'agent-1',
      handler: async (input) => {
        if (String(input) === 'Task A') {
          throw new Error('Task A failed');
        }
        return { output: `done:${String(input)}` };
      },
    });

    const nodeA = makeNode('a', 'Task A', [], 'agent-1');
    const nodeB = makeNode('b', 'Task B', ['a'], 'agent-1');
    const nodeC = makeNode('c', 'Task C', [], 'agent-1');
    const tree = new TaskTree('a', [nodeA, nodeB, nodeC]);

    const result = await runtime.executePlan(tree);

    expect(result.status).toBe('failed');
    expect(result.completedTaskIds).toEqual(['c']);
    expect(result.failedTaskIds).toEqual(['a']);
    expect(nodeA.status).toBe(TaskStatus.Failed);
    expect(nodeB.status).toBe(TaskStatus.Blocked);
    expect(nodeC.status).toBe(TaskStatus.Completed);
  });

  it('marks a node as failed and re-throws when executeTaskNode agent throws', async () => {
    const runtime = new AgentRuntime({ planner: new PlannerEngine() });
    runtime.createAgent({
      agentId: 'agent-1',
      handler: async () => {
        throw new Error('Agent execution failed');
      },
    });

    const nodeA = makeNode('a', 'Task A', [], 'agent-1');
    const tree = new TaskTree('a', [nodeA]);

    await expect(runtime.executeTaskNode('a', tree)).rejects.toThrow('Agent execution failed');
    expect(nodeA.status).toBe(TaskStatus.Failed);
    expect(nodeA.error).toBe('Agent execution failed');
  });

  it('blocks a node when executeTaskNode has a failed dependency', async () => {
    const runtime = new AgentRuntime({ planner: new PlannerEngine() });
    runtime.createAgent({
      agentId: 'agent-1',
      handler: async () => ({ output: 'done' }),
    });

    const nodeA = makeNode('a', 'Task A', [], 'agent-1');
    const nodeB = makeNode('b', 'Task B', ['a'], 'agent-1');
    const tree = new TaskTree('a', [nodeA, nodeB]);

    // Mark A as failed before execution
    nodeA.status = TaskStatus.Failed;

    await expect(runtime.executeTaskNode('b', tree)).rejects.toThrow(
      /Dependencies for task 'b' are not all completed/
    );
    expect(nodeB.status).toBe(TaskStatus.Blocked);
  });
});

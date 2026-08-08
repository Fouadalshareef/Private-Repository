# TASK-0045 — Planner Contract

## Purpose

This document defines the authoritative Planner contract implemented during TASK-0045. It records the interface between the Planner subsystem and the AgentRuntime, and the internal data model used to represent plans.

The Planner is a **replaceable subsystem**. AgentRuntime depends on the Planner only through an explicit interface (`Planner`), never through concrete implementation details.

---

## 1. Status Model

The Planner maintains its own authoritative task status model:

```ts
export enum TaskStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
  Blocked = 'blocked',
}
```

> **Note:** The Orchestrator maintains a separate status model (which includes `ReviewRequired`) for orchestration workflow states. The two are intentionally separate and must not be force-merged.

---

## 2. Core Types

### TaskNode

A single node in a task tree / DAG.

```
ts
export interface TaskNode {
  readonly id: string;
  readonly description: string;
  status: TaskStatus;
  readonly dependencies: readonly string[];
  readonly assignedAgent?: string;
  result?: unknown;
  error?: string;
}
```

The structure is intentionally minimal and extensible. Additional fields (subtasks, effort, priority) may be added without breaking existing consumers.

### TaskTree

A task tree / DAG describing a plan. Represented as a flat node collection with explicit dependency edges, supporting both strict trees and general DAGs.

```
ts
export interface TaskTree {
  readonly rootId: string;
  readonly nodes: readonly TaskNode[];
}
```

### PlannerResult

The result of executing a task tree.

```ts
export interface PlannerResult {
  readonly rootId: string;
  readonly status: 'completed' | 'failed' | 'cancelled';
  readonly completedTaskIds: readonly string[];
  readonly failedTaskIds: readonly string[];
  readonly durationMs: number;
  readonly errors: readonly string[];
  readonly taskTree: TaskTree;
}
```

---

## 3. Planner Interface

AgentRuntime depends on the Planner only through this contract:

```
ts
export interface Planner {
  planTask(goal: string): Promise<TaskTree>;
  validateTaskTree(tree: TaskTree): void;
  getNodeById(taskId: string): TaskNode | undefined;
  updateNodeStatus(taskId: string, status: TaskStatus): void;
}
```

### Method Semantics

| Method | Description |
|--------|-------------|
| `planTask(goal)` | Generates a task tree from a natural-language goal. Throws `PlanningError` for an empty goal. |
| `validateTaskTree(tree)` | Validates a task tree before execution. Throws `PlanningError` if the tree is invalid. |
| `getNodeById(taskId)` | Returns a node by id, or `undefined` if not found. |
| `updateNodeStatus(taskId, status)` | Updates the status of a node. Throws `PlanningError` if the node does not exist. |

---

## 4. Errors

### PlanningError

Thrown when a planning operation fails (invalid tree, empty goal, missing node).

```
ts
export class PlanningError extends Error {}
```

### PlannerNotAttachedError

Thrown when a Planner operation is requested on `AgentRuntime` but no Planner is attached.

```
ts
export class PlannerNotAttachedError extends Error {
  constructor() {
    super('Planner is not attached to the runtime');
    this.name = 'PlannerNotAttachedError';
  }
}
```

---

## 5. TaskTreeManager

A helper that manages a task tree: validation, topological ordering, node lookup, and status updates.

```
ts
export class TaskTreeManager {
  getTree(): TaskTreeType;
  getNodeById(id: string): TaskNode | undefined;
  updateNodeStatus(id: string, status: TaskStatus): void;
  validate(): void;
  topologicalOrder(): readonly TaskNode[];
}
```

### Validation Rules

`validate()` detects:

- Empty node `id` or `description`
- Duplicate node IDs
- Missing dependencies (deps referencing unknown nodes)
- Self-dependencies
- Dependency cycles (DFS-based)
- Missing root node

### Topological Order

`topologicalOrder()` returns nodes in dependency order (a node appears after all of its dependencies). Throws `PlanningError` if the graph contains a cycle.

---

## 6. PlannerEngine

A deterministic, unit-testable implementation of `Planner`.

### planTask

Produces a **single root node** task tree from a goal. This is a deterministic baseline that preserves extensibility toward multi-node planning. Throws `PlanningError` for an empty goal.

### executePlan

Executes a task tree in dependency order:

1. Validates the tree.
2. Computes topological order.
3. For each pending node:
   - Skips nodes whose dependencies are not all `Completed`.
   - Marks a node `Blocked` if any dependency is `Failed`.
   - Executes the node via a provided callback.
   - Marks the node `Completed` on success, `Failed` + records error on failure.
   - Marks all direct dependents `Blocked` on failure.
4. Returns a `PlannerResult`.

---

## 7. AgentRuntime Integration

`AgentRuntime` integrates the Planner as an optional dependency:

| Method | Description |
|--------|-------------|
| `setPlanner(planner: Planner)` | Attaches a Planner to the runtime. |
| `getPlanner(): Planner \| undefined` | Returns the attached Planner, if any. |
| `planTask(input: string): Promise<TaskTree>` | Delegates to the Planner. Throws `PlannerNotAttachedError` if no Planner. |
| `executePlan(taskTree: TaskTree): Promise<PlannerResult>` | Validates, topologically orders, and executes each node via its assigned agent. Throws `PlannerNotAttachedError` if no Planner. |
| `executeTaskNode(taskId: string, taskTree: TaskTree): Promise<AgentStepResult>` | Executes a single node by id after validating dependencies and assigned agent. |

### Config

`AgentRuntimeConfig` now includes an optional `planner` field:

```
ts
export interface AgentRuntimeConfig {
  readonly memory?: MemoryBundle;
  readonly eventBus?: IEventBus;
  readonly planner?: Planner;
}
```

---

## 8. Public Exports

`src/planner/index.ts` re-exports:

- `TaskStatus`, `TaskNode`, `TaskTree`, `Planner`, `PlannerResult`
- `PlanningError`, `PlannerNotAttachedError`
- `PlannerEngine`
- `TaskTree` (as `TaskTreeImpl`), `TaskTreeManager`
- `TaskStatus` (as `PlannerTaskStatus`)

# TASK-0044 — Planner Boundary

This document describes the architectural contract between `AgentRuntime` and the (missing) Planner subsystem, summarizes what I changed in `AgentRuntime` for TASK-0044, and records what remains blocked until a Planner implementation or a dedicated shim is provided.

## 1. High-level intent

AgentRuntime must depend on Planner only through a small, well-defined interface (types + behavior). The runtime should not implement planning algorithms; it should call into a Planner provider that implements the contract. The Planner is a downstream dependency and may be injected at runtime.

## 2. What existed in `AgentRuntime` before my edits (summary)
- Direct imports from `src/planner/*` (planner-engine, task-tree, types).
- Concrete calls into planner APIs from methods such as `planTask`, `executePlan`, and `executeTaskNode`.
- Planner-derived types were used at runtime and compile-time (TaskTree, TaskNode, PlannerResult).
- Some event publishing assumed planner-produced payloads (eg. `planner.tasktree.created`).

## 3. What I changed in `AgentRuntime` for TASK-0044
- Removed the broken static imports from `src/planner/*` (because the planner source tree is absent).
- Kept the public planner-facing methods but neutralized their behavior to avoid inventing Planner logic:
  - `planTask(_input: string): Promise<null>` — returns `null` immediately.
  - `executePlan(): Promise<{ result: boolean }>` — returns `{ result: false }` immediately.
  - `executeTaskNode(): Promise<AgentStepResult>` — throws `new Error('Planner integration is not available')`.
- Left lifecycle events (`agent.execution.started`, etc.) and the `publish()` helper unmodified.

> Files directly changed: `src/agent/agent-runtime.ts` (planner imports removed, planner methods stubbed as described).

## 4. Assessment: does this preserve the architectural contract?
- Short answer: No — the runtime surface (method names/signatures) remains, but the behavior is intentionally degraded.
- The method signatures are present, which preserves part of the contract (APIs exist), but the methods are non-functional placeholders. Any caller expecting a real plan, plan execution, or node execution will receive `null`, a false result, or an exception.

This means higher-level orchestration or UI components that rely on planner results will not operate correctly until the Planner contract is fulfilled.

## 5. The correct Planner contract (what AgentRuntime needs)
AgentRuntime needs the following minimal contract from a Planner provider (types + behaviors):

- Types (compile-time):
  - `TaskTree` — a tree/DAG describing nodes and dependencies.
  - `TaskNode` — id, description, status, assignedAgent, dependencies, result, error.
  - `PlannerResult` — status, rootId, timestamps, any diagnostics.

- Runtime API (async/await):
  - `plan(input: string): Promise<TaskTree>` — generate a TaskTree from an NL prompt.
  - `executePlan(tree: TaskTree, options?): Promise<PlannerResult>` — run the task tree to completion or until paused/failed.
  - `executeNode(nodeId: string, context?): Promise<AgentStepResult>` — execute a single node, returning `AgentStepResult` as the runtime expects.

- Events and observability:
  - Publish `planner.tasktree.created` with `{ taskTree }` when a plan is produced.
  - Publish node-level progress events (optional) with well-defined payload shapes.

- Error semantics:
  - Planner errors must translate to well-known runtime exceptions or `PlannerResult` values so AgentRuntime and Orchestrator can react deterministically.

## 6. Can we preserve the contract without creating Planner source?
- Yes — but only by introducing explicit, compile-only planner interfaces and an injection point (e.g. `setPlanner(planner: PlannerInterface)`), or by shipping a lightweight runtime shim that implements the Planner interface and throws or returns explicit `NotImplemented` errors.
- The essential approach is: do NOT hard-remove planner APIs. Instead provide typed stubs or a `PlannerAdapter` interface that is `undefined` when planner is not present; runtime calls should detect `undefined` and surface a clear NotAvailable error rather than silently returning `null` or a false success result.

## 7. Recommendation (for TASK-0045)
- Restore method signatures to return explicit `Promise<TaskTree | null>` with `null` only used to indicate "no planner attached" and throw a dedicated `PlannerNotAttachedError` when an operation requires a planner.
- Add a `src/planner/types.d.ts` (type-only) that exposes the `PlannerInterface` and `TaskTree/TaskNode` types as part of the contract. This is small and purely compile-time — it does not implement Planner logic and therefore would be acceptable as a boundary shim in TASK-0044 only if you permit a type-only file. If you prefer no planner files at all in TASK-0044, then keep the runtime methods but surface `PlannerNotAttachedError` rather than returning `null`.
- For TASK-0045: implement `PlannerInterface` and a minimal adapter that either delegates to the real planner or to a test shim used in unit tests.

## 8. Blocker status
- Missing `src/planner/` is a blocker for any work that requires actual planning results. I mark this as a blocker for TASK-0045: a planner implementation (or at minimum a typed injection shim plus dedicated adapter) is required to restore full agent planning capability.


---

Document prepared by the recovery work for TASK-0044. Do not implement Planner code in TASK-0044 itself; this file defines the boundary for the next task.

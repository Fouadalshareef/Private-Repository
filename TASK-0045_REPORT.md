# TASK-0045 — Planner Engine & AgentRuntime Planner Integration

## Status: COMPLETE

## Objective

Implement a real, coherent Planner subsystem in `cupaw-core` and integrate it cleanly into `AgentRuntime` through an explicit contract. The previous working tree contained a stub Planner that was not functional. This task replaces the stub with a deterministic, unit-testable Planner Engine and wires it into the AgentRuntime.

---

## Summary of Changes

### 1. `src/planner/types.ts` — Extended

Added the authoritative Planner contract:

- `PlannerResult` interface (rootId, status, completedTaskIds, failedTaskIds, durationMs, errors, taskTree)
- `validateTaskTree()` added to the `Planner` interface
- `PlannerNotAttachedError` class
- `TaskStatus` documented as the authoritative planner status (separate from Orchestrator's status model which includes `ReviewRequired`)

### 2. `src/planner/task-tree.ts` — Implemented

- `TaskTree` class implementing the `TaskTree` interface
- `TaskTreeManager` with:
  - `getNodeById` — node lookup
  - `updateNodeStatus` — status updates
  - `validate` — duplicate/missing/self-deps/cycle detection
  - `topologicalOrder` — DFS-based dependency ordering

### 3. `src/planner/planner-engine.ts` — Implemented

`PlannerEngine` now provides:

- `planTask()` — produces a deterministic single-root task tree
- `validateTaskTree()` — validates a tree before execution
- `getNodeById()` / `updateNodeStatus()` — node access
- `executePlan()` — dependency-aware execution with failure blocking (marks dependents `Blocked` when a dependency fails)

### 4. `src/planner/index.ts` — Fixed

- Explicit re-exports instead of ambiguous `*` re-exports
- `TaskTree` as `TaskTreeImpl` from task-tree.ts
- `TaskStatus` as `PlannerTaskStatus` from task-tree.ts

### 5. `src/agent/types.ts` — Updated

- `AgentRuntimeConfig` now includes `readonly planner?: Planner`

### 6. `src/agent/agent-runtime.ts` — Fixed

- Uses `PlannerNotAttachedError` instead of generic `Error` when Planner is missing
- Fixed implicit `any` on `depId` parameters (typed as `string`)

### 7. Tests Created

- `tests/planner/task-tree.test.ts` — 13 tests (TaskTree construction, getNodeById, updateNodeStatus, missing update, valid/invalid trees, duplicates, missing deps, self-deps, cycles, empty id/description, missing root, topological order, cycle in topo)
- `tests/planner/planner-engine.test.ts` — 12 tests (construction, planTask, empty goal rejection, validate, getNodeById, updateNodeStatus, successful execution, failure with blocking, dependency ordering, unmet deps)
- `tests/planner/agent-runtime-planner.test.ts` — 11 tests (PlannerNotAttachedError on planTask, planTask through runtime, executePlan, executeTaskNode, unmet deps, missing assigned agent, set/get planner)

### 8. `eslint.config.js` — Updated

- Added ignores for `HEAD_*.ts`, `tsc-errors.txt`, `tsc-check.txt`, `lint-check.txt`, `vitest-dot.txt`, `vitest-report.json` (UTF-16 binary diagnostic snapshot files that eslint cannot parse)

---

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npx tsc --noEmit` | ✅ PASS |
| Lint | `npm run lint` | ✅ PASS |
| Tests | `npm test` | ✅ PASS |
| Build | `npm run build` | ✅ PASS |

### Test Summary

```text
Test Files  43 passed (43)
     Tests  1088 passed (1088)
  Duration  48.02s
```

---

## Architectural Decisions

### Planner is a Replaceable Subsystem

`AgentRuntime` depends on the Planner only through the `Planner` interface. No concrete implementation details leak into the runtime. This preserves the architecture principle:

```
text
AgentRuntime
     |
     v
 Planner contract
     |
     v
 Planner implementation
```

### TaskStatus is Authoritative to the Planner

The Planner maintains its own `TaskStatus` enum (`pending`, `in_progress`, `completed`, `failed`, `blocked`). The Orchestrator has a separate status model (which includes `ReviewRequired`) for orchestration workflow states. These are intentionally separate and were not force-merged.

### Deterministic Planning Baseline

`planTask()` currently produces a single-root task tree. This is a deterministic baseline that can be unit-tested without an external LLM. The structure supports expansion to multi-node DAG planning in a future task.

---

## Files Created

- `src/planner/types.ts` (rewritten)
- `src/planner/task-tree.ts` (rewritten)
- `src/planner/planner-engine.ts` (rewritten)
- `src/planner/index.ts` (fixed)
- `src/agent/types.ts` (updated)
- `src/agent/agent-runtime.ts` (fixed)
- `tests/planner/task-tree.test.ts` (created)
- `tests/planner/planner-engine.test.ts` (created)
- `tests/planner/agent-runtime-planner.test.ts` (created)
- `TASK-0045_PLANNER_CONTRACT.md` (created)
- `TASK-0045_REPORT.md` (created)

---

## Quality Standards Preserved

- ✅ No `any`
- ✅ No `@ts-ignore`
- ✅ No `@ts-expect-error`
- ✅ No `eslint-disable` used to hide real problems
- ✅ Strong TypeScript strict typing
- ✅ No duplicate/conflicting domain types
- ✅ No unnecessary dependencies
- ✅ No fake/stub behaviors pretending to be real behavior

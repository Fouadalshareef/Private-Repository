# TASK-0045-FIX — Execution Boundary & Failure Semantics Fix

## Status: COMPLETE

## Objective

Fix the execution boundary and failure semantics in the Planner/AgentRuntime. The original TASK-0045 implementation had gaps in failure propagation: a failed node did not correctly propagate to dependents (transitively), `executePlan` did not treat a `Blocked` dependency the same as a `Failed` dependency, and `AgentRuntime.executePlan()` did not record errors/failedTaskIds correctly when an agent failed. This fix tightens the failure semantics without redesigning the Planner or AgentRuntime outside the fix scope.

---

## Summary of Changes

### 1. `src/planner/planner-engine.ts` — Failure semantics fixed

- `executePlan()` now handles **pre-failed nodes**: a node already in `Failed` status before execution is recorded in `failedTaskIds` and `errors`.
- Detects a `Blocked` dependency in addition to a `Failed` dependency when deciding whether to skip/mark a node.
- `markDependentsBlocked()` is now **transitive**: it iterates in a while-loop until no further `Pending` node has a `Failed`/`Blocked` dependency, so A→B→C all downstream nodes get `Blocked` when A fails.
- Final `PlannerResult.status` is `'failed'` if **any** node is `Failed` or `Blocked` (including pre-failed nodes), otherwise `'completed'`.

### 2. `src/agent/agent-runtime.ts` — Failure propagation fixed

- `executePlan()`:
  - Handles pre-failed nodes (records them in `failedTaskIds`/`errors`).
  - Uses `hasFailedOrBlockedDep` check so a `Blocked` dependency blocks a node just like a `Failed` dependency.
  - Marks dependents `Blocked` **transitively** via a while-loop until no pending node has a failed/blocked dependency.
  - Wraps `agent.execute()` in try/catch: on failure sets node status to `Failed`, saves the error to `node.error`, adds to `failedTaskIds`/`errors`, and blocks dependents.
  - Final `hasFailure` is true if any node is `Failed` or `Blocked`.
- `executeTaskNode()`:
  - Rejects a node that is already `Failed` or `Blocked`.
  - Marks a node `Blocked` if any dependency is `Failed` or `Blocked`.
  - Marks node `InProgress` before executing.
  - Wraps `agent.execute()` in try/catch: on failure sets node status to `Failed`, saves `node.error`, then **re-throws** the error after status update.

### 3. Tests Added / Updated

- `tests/planner/planner-engine.test.ts`:
  - Updated test `'marks dependents as blocked when a dependency already failed'` to expect `status: 'failed'` + `failedTaskIds: ['a']` (was incorrectly expecting `'completed'`).
  - Added: `'blocks transitive dependents when a node fails'`, `'does not execute a node with a blocked dependency'`, `'continues independent branches when one branch fails'`.
- `tests/planner/agent-runtime-planner.test.ts`:
  - Added: `'marks a node as failed and blocks dependents when an agent throws'`, `'does not execute a node whose dependency is blocked'`, `'continues independent branches when one branch fails'`, `'marks a node as failed and re-throws when executeTaskNode agent throws'`, `'blocks a node when executeTaskNode has a failed dependency'`.

### 4. Documentation Updated

- `TASK-0045_PLANNER_CONTRACT.md`:
  - Documented that `AgentRuntime` uses the concrete `TaskTreeManager` helper directly for task-tree execution (in addition to the `Planner` interface for planning operations).
  - Documented the non-determinism of `planTask` node IDs (`Date.now()`).
  - Updated `executePlan` semantics: `Blocked` dependency is treated same as `Failed`, transitive blocking, and final status is `'failed'` if any node is `Failed` or `Blocked`.

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
     Tests  1096 passed (1096)
  Duration  24.26s (transform 11.51s, setup 0ms, collect 19.18s, tests 4.54s, environment 28ms, prepare 16.88s)
```

---

## Failure-Semantics Guarantees

1. **Agent failure → node `Failed`**: When an agent throws, the node is marked `Failed` and `node.error` is saved.
2. **Dependent → `Blocked`**: Direct dependents of a failed node become `Blocked`.
3. **Transitive blocking**: Downstream dependents (A→B→C) are also marked `Blocked`, not just direct dependents.
4. **`Blocked` nodes are never executed**: A node with a `Failed` or `Blocked` dependency is not executed.
5. **Independent branches continue**: A failure in one branch does not prevent independent branches from executing.
6. **`PlannerResult` correctness**: `failedTaskIds`, `completedTaskIds`, and `errors` accurately reflect the final tree state; `status` is `'failed'` if any node failed or was blocked.

---

## Files Modified

- `src/planner/planner-engine.ts` — failure semantics fixed
- `src/agent/agent-runtime.ts` — failure propagation fixed
- `tests/planner/planner-engine.test.ts` — test updated + new tests added
- `tests/planner/agent-runtime-planner.test.ts` — new tests added
- `TASK-0045_PLANNER_CONTRACT.md` — documentation updated
- `TASK-0045_REPORT.md` — TASK-0045-FIX section appended
- `TASK-0045-FIX_REPORT.md` — created

---

## Quality Standards Preserved

- ✅ No `any`
- ✅ No `@ts-ignore`
- ✅ No `@ts-expect-error`
- ✅ No `eslint-disable` used as a workaround
- ✅ Strong TypeScript strict typing
- ✅ No redesign of Planner/AgentRuntime outside fix scope
- ✅ Existing public APIs preserved
- ✅ No unnecessary dependencies
- ✅ No fake/stub behaviors pretending to be real behavior

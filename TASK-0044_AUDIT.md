# TASK-0044 Audit — Core Repository Recovery & Compilation Integrity

## 1. Scope

This audit covers the current `cupaw-core` repository state for the following areas:
- `src/agent/`
- `src/cli/`
- `src/conversation/`
- `src/events/`
- `src/memory/`
- `src/orchestrator/`
- `src/server/`
- `src/tools/`
- `src/workspace/`
- `package.json`
- `tsconfig.json`
- `eslint.config.js`
- `vitest.config.ts`

The goal is to identify actual missing modules, broken imports, public API boundaries, and compile-time blockers before any repair work.

## 2. Actual module existence

### Present source directories
- `src/agent/`
- `src/cli/`
- `src/conversation/`
- `src/events/`
- `src/memory/`
- `src/orchestrator/`
- `src/server/`
- `src/tools/`
- `src/workspace/`

### Absent source directories
- `src/planner/` (missing)
- `src/tui/` (missing)

### Absent expected files
- `src/server/api-bridge.ts` / `src/server/api-bridge.js` (missing)

## 3. Broken imports and missing modules

### Missing planner imports
- `src/agent/agent-runtime.ts` imports:
  - `../planner/planner-engine.js`
  - `../planner/task-tree.js`
  - `../planner/types.js`

### Missing CLI API bridge import
- `src/cli/index.ts` exports:
  - `../server/api-bridge.js`

### Missing orchestrator role exports
- `src/orchestrator/roles/index.ts` exports:
  - `./AgentRole.js`
  - `./RoleAssignment.js`

### Other broken source references
- `src/conversation/ConversationWorkspace.ts` imports:
  - `Events as ConversationEvents` from `./ConversationEvents.js` (wrong named export)
  - `Orchestrator, OrchestratorConfig` from `../orchestrator/agent-orchestrator.js` (module exports only `AgentOrchestrator` currently)

## 4. Public exports and intended module visibility

### `src/index.ts`
Public re-exports include:
- `./cli/index.js`
- `./agent/agent-runtime.js`
- `./tools/index.js`
- `./conversation/index.js`

### `src/cli/index.ts`
Currently exports CLI classes plus `../server/websocket-handler.js` and stale `../server/api-bridge.js`.

### `src/orchestrator/index.ts`
Re-exports `./agent-orchestrator.js` and `./roles/index.js`.

### `src/orchestrator/agent-orchestrator.ts`
Exports `AgentOrchestrator` plus type exports for orchestrator contracts.

## 5. Dependency direction and architecture notes

### Planner dependency
- The current Agent Runtime depends on planner contracts.
- Planner is a downstream dependency of `src/agent/agent-runtime.ts`.
- There is no planner implementation in the repository, so the contract must be preserved through type boundaries.

### API bridge dependency
- The CLI index currently exports `server/api-bridge.js`, but no current source imports that export.
- The CLI package does not appear to need the API bridge at compile time.
- The smallest correct fix is to remove the stale export, not to invent a new API bridge unless required.

### Orchestrator role abstractions
- `src/orchestrator/types.ts` is the authoritative source for `AgentRole`, `RoleAssignmentConfig`, and `TaskStatus`.
- `src/orchestrator/roles/index.ts` is a shallow barrel; the missing files should re-export from the authoritative `types.ts` rather than duplicate definitions.

### WebSocket handler
- `src/server/websocket-handler.ts` imports `WebSocket` type from `ws`, but the dependency is absent from `package.json`.
- The implementation is currently a stub and does not instantiate a real WebSocket server.
- This file should be made compile-safe without adding a production `ws` dependency in this recovery task unless a genuine runtime contract requires it.

## 6. Relevant compile and type errors

The current `npx tsc --noEmit` failure set includes:
- missing planner module imports in `src/agent/agent-runtime.ts`
- invalid private method `_agentIsPlanning` access in `src/agent/agent-runtime.ts`
- incorrect `AgentStepResult` structure in `src/agent/agent-runtime.ts`
- `ConversationEvents` import mismatch in `src/conversation/ConversationWorkspace.ts`
- missing `Orchestrator` export in `src/conversation/ConversationWorkspace.ts`
- missing `requireMemory` method in `src/conversation/ConversationWorkspace.ts`
- incompatible `IEventBus.publish()` call signatures in `src/orchestrator/agent-orchestrator.ts`
- misuse of `import type` values in `src/orchestrator/agent-orchestrator.ts`

## 7. External dependency check

### Declared dependencies
- `@eslint/js`
- `@types/node`
- `eslint`
- `prettier`
- `typescript`
- `typescript-eslint`
- `vitest`

### Potential but non-required packages
- `ws` (referenced only as a type in `src/server/websocket-handler.ts`)
- `react`, `ink`, `@types/react` (not used by current source)

Conclusion: these should not be added unless the current source genuinely requires them.

## 8. Circular dependency review

No obvious circular dependency was found in the audited source graph.
The main problematic references are missing modules and stale exports, not cycles.

## 9. Audit conclusions

### Key recovery targets
- Repair `src/orchestrator/roles/` exports using the authoritative `src/orchestrator/types.ts` definitions.
- Remove the stale CLI API bridge export.
- Define a planner boundary as a compile-time contract without implementing planner behavior.
- Fix `ConversationWorkspace` imports and missing `requireMemory` API.
- Preserve strict typing and do not add new `any` or fake implementations.

### Blocking issues for Task-0044
- Missing planner source tree
- Missing `src/server/api-bridge.js`
- Missing orchestrator role barrel modules
- Broken `ConversationWorkspace` API imports

A repair plan should proceed from these audit findings without redesigning core architecture.

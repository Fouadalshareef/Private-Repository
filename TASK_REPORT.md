# TASK-0035 Report — Advisor CLI Integration & Arabic Routing

**Status:** ✅ Complete
**Date:** 2026-08-07
**Branch:** `main`
**Commit:** `ecd9033` (addendum) — `3c03503` (base)

---

## 1. Overview

TASK-0035 integrates the Collaborative Conversation Runtime (TASK-0034) with the Cupaw CLI, exposing advisor collaboration through interactive commands, and adds multilingual (Arabic) advisor routing plus error-resilience hardening. This task was delivered in two parts:

- **Base deliverable:** `AdvisorCLIController` + new CLI commands (`/active`, `/session`, `/sessions`, `/collaboration`, `/resume`) and `/switch` workspace integration.
- **Addendum:** Arabic routing dictionary expansion, Mock Provider mode indicator, and session-resilience protection.

---

## 2. Modified & New Files

### New Files
| File | Purpose |
|------|---------|
| `src/cli/handlers/AdvisorCLIController.ts` | Controller bridging `ConversationRuntime` to CLI commands. Handles `/active`, `/session`, `/sessions`, `/collaboration`, `/resume`, and `/switch` workspace sync. |
| `tests/cli/AdvisorCLIController.test.ts` | 28 tests — controller behavior, immutability, session resilience, and 6 Arabic routing integration tests. |
| `tests/cli/AdvisorCLIHandler.test.ts` | 27 tests — advisor listing, routing, switching, and 6 Arabic multilingual routing tests. |

### Modified Files
| File | Change |
|------|--------|
| `src/cli/CupawCLI.ts` | Routes controller commands after advisor handler; adds `AIProviderType` import; prints `AI Provider:` status line in `/session` (Mock vs Live LLM). |
| `src/cli/CLIConfig.ts` | Adds `conversationRuntime` field to config interface + factory creation. |
| `src/cli/index.ts` | Exports `AdvisorCLIController`. |
| `src/advisors/ContextRouter.ts` | Expanded multilingual keyword dictionary for all 11 advisors (weighted Arabic terms). |
| `src/advisors/AdvisorCatalog.ts` | Expanded `routingKeywords` with additional Arabic term mappings per advisor. |
| `src/conversation/ConversationWorkspace.ts` | Fixed `listSessions()` to delegate to session manager (bug fix from base delivery). |
| `tests/CLIIntegration.test.ts` | Added Mock Provider mode indicator assertion. |

---

## 3. Architectural Decisions

1. **Controller isolation.** `AdvisorCLIController` is a thin, pure, deterministic facade over `ConversationWorkspace`. It holds no AI provider or routing logic — routing remains the responsibility of `AdvisorCLIHandler`/`ContextRouter`. This keeps the controller testable and free of side effects.

2. **Command dispatch order.** In `CupawCLI.handleCommand`, the advisor handler is tried first, then the controller. Both return a discriminated `unknown`/`handled` result when they do not own the command, allowing a clean pipeline without overlap.

3. **Workspace as single source of truth.** The controller does not maintain its own session map. `switchAdvisor` resolves the active session from `workspace.listSessions()` and reuses it if present — preventing duplicate sessions across consecutive `/switch` turns (session resilience requirement).

4. **Deterministic, provider-free routing.** Arabic routing uses the same rule-based `ContextRouter` as English. No LLM/AI call is involved; confidence is derived from matched keyword count and weighted keyword length. This guarantees reproducibility and zero cost.

5. **Explicit Mock Provider signal.** Rather than silently running on the `MockAIProvider`, the `/session` output now surfaces `AI Provider: Mock Provider` (or `Live LLM Provider`). This sets the expectation that dynamic response generation is fully hooked in **TASK-0042**, while the execution runtime stays stable today.

6. **Immutable outputs.** All controller command outputs (`active`, `session`, `sessions`, `collaboration`, `resume`) are `Object.freeze`d recursively, preserving the codebase's immutability contract.

---

## 4. Multilingual Advisor Routing (Arabic)

The `ContextRouter` keyword dictionary and `AdvisorCatalog.routingKeywords` were extended with explicit Arabic term mappings for all 11 advisors. Routing is verified by integration tests against `ContextRouter` directly.

### Verified Arabic Routing Examples
| Arabic Query | Routed Advisor | Confidence |
|--------------|----------------|------------|
| `اريد بناء واجهة مستخدم` ("I want to build a user interface") | `ui-designer` / `frontend-engineer` | > 0.70 |
| `تصميم واجهة` ("interface design") | `ui-designer` / `frontend-engineer` | > 0.70 |
| `قواعد بيانات SQL` ("SQL databases") | `database-architect` | > 0.70 |
| `ثغرات أمنية` ("security vulnerabilities") | `security-advisor` | > 0.70 |
| `معمارية النظام` ("system architecture") | `chief-ai-architect` | > 0.50 |
| `واجهات برمجة التطبيقات` ("APIs") | `backend-engineer` | > 0.70 |

### Fallback Policy
Fallback to `chief-ai-architect` (then `software-engineer`) is **restricted to queries with zero keyword intersections**. Any query matching at least one weighted keyword is routed by keyword/metadata, never by fallback.

---

## 5. Test Results

| Suite | Result |
|-------|--------|
| Unit tests (`vitest run`) | ✅ **988 passed** (37 test files) |
| Lint (`eslint .`) | ✅ **0 errors, 0 warnings** |
| Build (`tsc`) | ✅ Passes |

### Test Coverage by Area
- `AdvisorCLIController.test.ts` — 28 tests (incl. 6 Arabic routing, 3 session resilience)
- `AdvisorCLIHandler.test.ts` — 27 tests (incl. 6 Arabic routing)
- `CLIIntegration.test.ts` — 20 tests (incl. Mock Provider indicator)
- `ConversationRuntime.test.ts` — 36 tests
- `ContextRouter.test.ts` — 29 tests
- All other suites — no regressions

**Success rate:** 100% (988/988).

---

## 6. Acceptance Criteria — Final Verification

| Criterion | Status |
|-----------|--------|
| New CLI commands `/active`, `/session`, `/sessions`, `/collaboration`, `/resume` | ✅ |
| `/switch` updates `ConversationRuntime` workspace sessions | ✅ |
| Arabic routing for ≥5 distinct Arabic prompts | ✅ (6 prompts verified) |
| Mock Provider mode indicator in `/session` | ✅ |
| No duplicate session creation on consecutive `/switch` | ✅ |
| All existing tests pass without regressions | ✅ (988 passing) |
| Build & lint clean | ✅ |

---

## 7. Notes / Forward Dependencies

- Dynamic, LLM-generated advisor responses are **not** yet wired — the system intentionally runs on `MockAIProvider`. Full dynamic response generation is scheduled for **TASK-0042**.
- No real API calls are made; the runtime remains provider-independent and deterministic.
- No breaking changes introduced; all outputs are backward compatible.

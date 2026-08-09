# ADR-0046: Semantic / Behavioral Learning from Explicit User Feedback

**Status**: Accepted  
**Date**: 2026-08-09

## Context

Cupaw AI needs a bounded way to improve future behaviour from user feedback without changing model weights, planner algorithms, or security policy. The existing architecture already provides the relevant separation points: a synchronous in-process `EventBus`, a layered memory architecture with semantic memory and project preferences, a memory layer in `PromptEngine`, a `ContextRouter`, a planner, and independently enforced session and tool-authorization boundaries.

The requested TASK-0046 discovery report and design specification were not present as separately named files in this checkout at the time of this ADR. This decision is therefore validated against the current repository architecture and `TASK_REPORT.md`; no contradiction with the decisions below was found. The missing source documents do not authorize assumptions about their unresolved implementation details.

## Decision

### Learning strategy

TASK-0046 V1 will implement **Semantic / Behavioral Learning**, not true reinforcement learning. Its conceptual flow is:

```text
Explicit User Feedback
        -> Feedback Interpretation
        -> Semantic Rule / Preference
        -> Learned Preferences / Project Context
        -> Future Context / Prompt
        -> Improved Agent Behavior
```

V1 will not implement a mathematical reward model, policy optimization, policy gradients, model-weight training, fine-tuning, or any other form of true RL. This matches Cupaw's LLM- and prompt-oriented architecture: reusable behavioural knowledge is supplied as explicit context to an unchanged model rather than used to optimize its policy or weights.

### Feedback model and evaluation

The primary learning input is **Explicit User Feedback**, including corrections, instructions, rejections, ratings, and thumbs up/down.

Execution failures, tool failures, planner failures, token usage, and latency are **System Observations**, not user feedback. In V1, system observations are not automatically learned as permanent user preferences. A transient technical failure does not reliably express the user's intent; treating it as such could create a false, persistent rule.

Likewise, a successful agent outcome is a system outcome, not sufficient evidence of user approval. User feedback is the primary V1 signal for deciding what to learn.

### Layer and event boundary

The Learning System will be introduced later as an independent `src/learning/` layer. It must remain separate from `src/agent/`, `src/planner/`, `src/memory/`, `src/prompt/`, and `src/security/`, integrating through explicit interfaces and events rather than internal coupling.

`EventBus` is the primary decoupling point. The planned architectural event flow is:

```text
User Feedback
        -> EventBus
        -> Learning System
        -> Semantic Rule / Preference
        -> Memory / Project Context
        -> ContextRouter
        -> PromptEngine
        -> Agent / Planner Context
```

The following are proposed event concepts only, not event types added by this ADR:

```text
user.feedback.received
learning.signal.created
learning.preference.updated
```

Keeping learning separate avoids making the Agent responsible for persistence and interpretation, avoids making Memory responsible for learning policy, and allows the feature to be disabled, tested, and evolved without changing core runtime responsibilities.

### Feedback-to-rule processing

The intended V1 pipeline is:

```text
Explicit User Feedback
        -> Normalize
        -> Evaluate / Extract
        -> Semantic Rule
        -> Store
```

V1 is expected to use the existing LLM capability for semantic rule extraction rather than a regex-only system. This is a revisable design choice, not an authorization to implement it in this ADR. LLM extraction must be treated as fallible because it can hallucinate, misinterpret feedback, over-generalize, or learn accidentally.

An explicit user instruction is a strong candidate for learning. Non-explicit observations require caution, and no general permanent preference may be invented from one event without a clear basis. A confidence engine is deferred; these are conceptual safety criteria for its later design.

### Memory, prompt, and planner integration

Conversation memory records **what happened**. Learned preferences and project context record **what was learned**. A complete conversation must not be stored as learned knowledge. Learned knowledge is an abstract rule, preference, or behavioural instruction suitable for reuse.

Learning affects the Agent indirectly through context, not by directly modifying agent behaviour:

```text
Learned Preferences
        -> ContextRouter
        -> PromptEngine
        -> AgentContext
        -> Agent
```

The Learning System does not replace the Planner. It may later supply learned context such as an explicitly rejected approach, a known project preference, or an explicit user rule; the Planner remains solely responsible for planning decisions. This ADR does not modify the planner algorithm.

### Disablement

Learning **must be disable-able through configuration** when it is implemented. This supports privacy, user control, operation without persisted learned knowledge, and reliable testing and diagnosis. This ADR does not add configuration.

## Consequences

- TASK-0046 implementation will need a focused learning layer and explicit integration contracts rather than changes embedded in Agent or Memory internals.
- User feedback must be distinguished from operational telemetry before anything becomes durable learned knowledge.
- Learned preferences can improve subsequent prompts and planning context while leaving the model, planner, and security policy unchanged.
- LLM-based extraction requires validation, conservative persistence criteria, and test coverage before it can be trusted as an implementation mechanism.
- The independent boundary permits learning to be disabled without removing conversation, planning, or security capabilities.

## Security Considerations

**Learned Preference is not Security Permission.** A learned preference such as “the user prefers tool X” never authorizes tool X. Every tool operation must still pass through `ToolAuthorizationEngine`; the Learning System must not bypass `SessionManager`, `ToolAuthorizationEngine`, or any security boundary. It must not produce automatic authorization rules or security-policy changes.

## Privacy Considerations

Complete conversations must not become learned knowledge. Persisted learning is limited to an abstract rule, preference, or behavioural instruction.

Passwords, API keys, tokens, secrets, and credentials must never be converted into learned preferences or retained as learned memory. The future implementation must preserve the existing secret-handling boundaries when normalizing, extracting, storing, and injecting learned context.

## Scope

TASK-0046 V1 is limited to this conceptual outcome:

```text
Explicit User Feedback
        -> Semantic Learning
        -> Learned Preferences / Rules
        -> Context
        -> Future Agent Behavior
```

## Out of Scope

- True RL, reward optimization, policy gradients, model-weight training, and fine-tuning.
- Automatic tool authorization or security-policy changes.
- Automatic planner-algorithm modification.
- Automatic permanent learning from arbitrary system failures.
- A dedicated GUI/TUI learning-management interface.
- Any implementation work, event definitions, interfaces, configuration, dependencies, or source-code changes.

## Open Decisions

The following details remain open because no separately accessible TASK-0046 design specification in this checkout resolves them:

1. The final Feedback API shape.
2. The final Learned Rule representation.
3. How confidence is measured and thresholded.
4. How incorrect learning is detected and prevented.
5. How learned preferences are reviewed, managed, and deleted.
6. Whether a rule is scoped to project, session, user, or another boundary.
7. How LLM-based feedback extraction is tested and evaluated.
8. Whether learning needs its own provider abstraction or uses the existing one.

---

## Addendum — 2026: Evidence & Confidence Policy (TASK-0046-D-FIX)

**Status**: Accepted (addendum to ADR-0046)  
**Date**: follows the ARCH-0046-01 analysis and the TASK-0046-D-FIX architectural decision.

This addendum resolves the open decision #3 ("How confidence is measured and thresholded") for the V1 boundary and formalises the `LearningSignal -> LearnedRule` transition. It does not change the base ADR decisions; it preserves the security, privacy, scope, and layer boundaries defined above.

### Evidence model

The system introduces a supporting, transient concept `LearningEvidence` that records that a `LearningSignal` constitutes one unit of support for a candidate rule within a specific scope:

```text
LearningEvidence
├── evidenceId          (unique)
├── sourceFeedbackId    (provenance -> original feedback)
├── signalId            (provenance -> originating signal)
├── feedbackType
├── candidate
├── scope               (Session / Conversation / Project)
├── context             (ids)
└── createdAt
```

- Evidence is **scoped exactly** like the signal that produced it. An evidence item never widens its scope.
- Evidence is **transient** (in-memory, process lifetime). It is not persisted to Memory or `ProjectContextStore`.
- Each eligible signal produces exactly one evidence item. Multiple evidence items sharing the same scope and the same normalized candidate constitute **repetition** support.

### Confidence semantics

`LearnedRule.confidence?: number` (range `[0, 1]` when present) is defined as:

> The degree to which the system is policy-justified in promoting a `LearningSignal`, backed by `LearningEvidence`, to a `LearnedRule` within its declared scope.

It is **not** a statistical probability, a model-output score, or a user rating. It is only produced by an **approved, documented numeric policy**. Per `ARCH-0046-02` and `ARCH-0046-03`, no such numeric policy is adopted in this phase, so `confidence` is **optional** and remains **undetermined / deferred**. A `LearnedRule` is created on the basis of eligibility, scope, and evidence alone; it does not require a confidence value.

### Feedback eligibility policy

| Feedback Type | Signal produced | Rule eligible | Evidence required | Scope policy |
| ------------- | --------------- | ------------- | ----------------- | ------------ |
| Instruction   | Yes             | Yes (single)  | None beyond signal | Preserved |
| Correction    | Yes             | Yes (single)  | None beyond signal | Preserved |
| Preference    | Yes             | Yes (single)  | None beyond signal | Preserved |
| Rejection     | Yes (scoped)    | **No**        | N/A               | Never widened |
| Approval      | No              | **No**        | N/A               | N/A |
| Rating        | No              | **No**        | N/A               | N/A |

Rationale: Instruction, Correction, and Preference are explicit, user-authored positive behavioural statements — strong candidates. Rejection is context-specific and must not generalise (consistent with the base ADR caution). Approval and Rating are not rule-producing (consistent with `SemanticFeedbackProcessor`, which emits no signal for them).

### Confidence calculation (deferred)

No numeric confidence calculation is implemented in this phase. Per `ARCH-0046-02`, no fixed baseline, repetition bonus, threshold, formula, or constant (e.g. `0.9`, `0.8`, `0.7`, `0.1`) is adopted as an approved policy value without a documented derivation. Per `ARCH-0046-03`, `LearnedRule.confidence` is **optional**; a rule is created on eligibility + evidence + scope, and confidence remains **undetermined / deferred** until an approved numeric policy exists.

### Rejection / Approval / Rating policy

- **Rejection** produces a scoped `LearningSignal` only and is **never** promoted to a `LearnedRule`. No implicit scope widening is permitted.
- **Approval** does not produce learning; approving a single action is conversational affirmation, not a durable preference.
- **Rating** (`rating: number`) is not rule-producing; a rating alone is never converted to an instruction, preference, or rule. Using ratings as aggregated evidence is a separate, deferred decision.

### Repetition policy

- Repetition is an **optional enhancer**, not a requirement. A single eligible signal (`Instruction`/`Correction`/`Preference`) can become a rule.
- Repetition requires **same scope** and **exact normalized candidate** match (deterministic; no LLM, no semantic-similarity in V1). Semantic equivalence is **deferred**.
- Repetition accumulation is **transient** (in-memory, process lifetime).
- Contradictory signals do **not** count as repetition.

### Contradiction policy

- A contradictory signal (opposite polarity within the same scope) reduces eligibility and does **not** contribute repetition support.
- Full supersession, versioning, expiration, and revocation of rules are **deferred** to a future decision. In V1, contradiction only blocks promotion; it does not delete stored rules or implement version history. It does not compute or adjust any numeric confidence value.

### Persistence boundary

- `LearningEvidence` is **transient**.
- `LearnedRule` is the durable artifact conceptually, but actual persistence to Memory / `ProjectContextStore` is **not** part of this task; the store remains the transient `InMemoryLearnedKnowledgeStore`. Persistence is a separate, future, explicitly-decided task.

### Security boundary

**Learning confidence NEVER grants authorization.** A `LearnedRule`, `LearningEvidence`, or confidence value never grants tool access, changes permissions, overrides security policy, or bypasses `ToolAuthorizationEngine` / `SessionManager`. No security/authorization fields are produced by the learning policy.

### Deferred decisions (retained from the base ADR)

- Semantic-equivalence-based repetition (LLM-dependent evaluation).
- Rating-as-aggregated-evidence policy.
- Rule supersession, versioning, expiration, and revocation.
- Rule review, management, and deletion UX.
- Persistence of learned rules to Memory / `ProjectContextStore`.
- LLM-based semantic extraction evaluation and its own provider abstraction.

---

## ARCH-0046-02 — Evidence & Confidence Policy Decision

**Status**: Accepted (architectural decision; documentation only)  
**Date**: 2026-08-09

This section formalises the Evidence & Confidence policy, converting the earlier Analysis (ARCH-0046-01) into an explicit, reviewable architectural decision. It is a **DOCUMENTATION decision only**: it does not implement `LearningSystem`, `InMemoryEvidenceStore`, `LearningConfidencePolicy`, `LearnedRule` creation, or new tests.

### Decision

Adopt the **HYBRID LEARNING + EVIDENCE LAYER** direction for the `LearningSignal -> LearnedRule` transition:

```text
LearningSignal
  -> Evidence / Eligibility
  -> LearningEvidence
  -> deterministic Confidence Policy
  -> LearnedRule
  -> ILearnedKnowledgeStore
```

This direction is consistent with the existing contracts (`LearningSignal`, `LearnedRule`, `ILearnedKnowledgeStore`, `LearningContext`, `LearningScope`) and with the base ADR-0046 boundaries. **No contract change is required by this decision.**

### Rationale

- Explicit user feedback is the only V1 learning signal; system observations are excluded.
- A deterministic, documented policy is preferable to a speculative numeric system with no documented basis.
- Separating **Eligibility** (may this feedback produce a rule?) from **Confidence** (how strong is the supporting evidence?) keeps the policy transparent, independent, and testable.
- Keeping Evidence transient and scoped preserves the boundaries in the base ADR.

### What was rejected

- Any fixed numeric confidence baseline (e.g. `0.9 / 0.8 / 0.7`) or repetition bonus (e.g. `0.1`) as an official policy value **without a documented derivation**. If such values appear in any draft, they are **UNAPPROVED POLICY ASSUMPTIONS** and are **not adopted** by this ADR.
- Repetition as a mandatory requirement for any feedback type in V1.
- Semantic-similarity or LLM-based repetition matching in V1.
- Any persistence of Evidence or LearnedRule in this phase.
- Any authorization, permission, or security-policy coupling.

### Feedback eligibility policy

| Feedback Type | Eligible for LearnedRule |
| ------------- | ------------------------ |
| Instruction   | Yes (single explicit signal, scoped) |
| Correction    | Yes (single explicit signal, scoped) |
| Preference    | Yes (single explicit signal, scoped) |
| Rejection     | No (scoped signal only; never generalised) |
| Approval      | No |
| Rating        | No |

### Evidence semantics

`LearningEvidence` records one unit of support for a candidate within a scope. It is:

- **Scoped**: exactly like the originating signal; it never widens scope.
- **Traceable**: links `sourceFeedbackId` and `signalId` back to origins.
- **Aggregatable**: capable of future repetition support without a large architectural change.
- **Transient**: in-memory, process lifetime; no persistence.
- **Non-authorizing**: it never grants permission or tool access.

### Confidence semantics

`LearnedRule.confidence: number` is a **deterministic, documented policy output** in `[0, 1]`, not a statistical probability, model score, or user rating. It represents the degree to which the system is policy-justified in promoting a `LearningSignal`, backed by `LearningEvidence`, to a `LearnedRule` within its declared scope.

The exact numeric derivation is **deferred** until a documented basis for any specific value exists. Confidence must be derived deterministically from eligibility + evidence strength, and must never be the sole arbiter of rule creation — Eligibility is a separate, independent gate.

### Threshold decision

**No fixed magic threshold** is adopted in this phase; there is no documented basis for a numeric threshold. Rule-creation eligibility is determined by feedback type + explicitness + scope + contradiction/evidence policy, **not** by a numeric threshold. If a future decision introduces a threshold, it must document its basis.

### Repetition policy

- Repetition is **optional**, not mandatory, for explicit `Instruction`, `Correction`, or `Preference`.
- Repetition, when supported, is an **additional evidence** signal within the same scope and exact normalized candidate.
- No semantic similarity or LLM matching in V1; only what the existing structure supports deterministically.

### Contradiction policy

- A contradictory signal (opposite polarity within the same scope) reduces eligibility and does not count as repetition support.
- The newer explicit rule within the same scope/context may supersede the earlier one, but history/provenance must not be silently deleted.
- Contradiction never permits scope widening.
- Full supersession, versioning, and history are deferred.

### Revocation policy

- The user may revoke a learned preference/rule in the future.
- The design must be able to support explicit revocation, supersession, and version/history.
- No persistence or full versioning system is added in this phase.

### Scope policy

- Evidence and LearnedRule are scoped exactly to the signal's scope/context.
- Session-scoped feedback never becomes a project-wide rule without an explicit decision.
- No automatic scope widening is permitted.

### Security boundary

**LearnedRule / Evidence / Confidence NEVER grant authorization.** They never grant permission, tool access, or security-policy changes, and never bypass `ToolAuthorizationEngine` or `SessionManager`.

### Architecture boundary

This decision does not modify `PromptEngine`, `ContextRouter`, `AgentContext`, `Planner`, `TaskTree`, `TaskNode`, GUI/TUI, `ToolAuthorizationEngine`, or `SessionManager`. Learning remains isolated. No persistence is added.

### Deferred decisions

- Numeric confidence derivation (needs a documented basis).
- Fixed numeric threshold (needs a documented basis).
- Rating-as-aggregated-evidence.
- Rule supersession, versioning, expiration, revocation.
- Rule review, management, deletion UX.
- Persistence of rules to Memory / `ProjectContextStore`.
- LLM-based semantic extraction evaluation and provider abstraction.

---

## ARCH-0046-03 — LearnedRule Confidence Contract Decision

**Status**: Accepted (architectural decision; documentation only)  
**Date**: 2026-08-09

This section resolves the contract conflict between the existing `LearnedRule.confidence: number` (a required numeric field) and `ARCH-0046-02` (which forbids any invented numeric confidence policy before a formal numeric policy is adopted). It is a **DOCUMENTATION decision only**; it does not implement, change contracts/code, or begin `TASK-0046-D-FIX`.

### Decision

Adopt OPTION B: change `LearnedRule.confidence` from a required field to an **optional** field.

```ts
// before
readonly confidence: number;

// after
readonly confidence?: number;
```

### Semantics

- **Presence** of `confidence: number` means the numeric confidence was computed according to an **approved numeric policy**.
- **Absence** of `confidence` means:

  > Confidence is currently undetermined / deferred.

- Absence does **NOT** mean any of the following:
  - `confidence = 0`
  - `confidence = 1`
  - low confidence
  - high confidence
  - failure
  - rejection
  - authorization

### Rationale

The decision is the result of a real conflict:

1. The legacy contract forces every `LearnedRule` to carry a `confidence: number`.
2. `ARCH-0046-02` forbids any unapproved numerical confidence policy (no magic numbers, no formula, no fixed threshold).

Using any default value (`0`, `0.5`, `0.7`, `0.8`, `0.9`, `1.0`) or any evidence-derived formula to satisfy the required field would be **inventing an unapproved policy**. Making the field optional allows a `LearnedRule` to exist without inventing a numeric value.

### What this decision does NOT mean

Making `confidence` optional:

- does **not** remove the concept of confidence;
- does **not** adopt a numerical confidence policy;
- does **not** add a threshold;
- does **not** permit magic numbers;
- does **not** grant `LearnedRule` any authorization;
- does **not** change the Security boundary;
- does **not** change `LearningScope`;
- does **not** widen scope;
- does **not** add persistence;
- does **not** add LLM-based confidence;
- does **not** change Prompt / Planner / Agent.

### Compatibility with ARCH-0046-02

`ARCH-0046-03` **complements** `ARCH-0046-02` and does **not** replace it. `ARCH-0046-02` remains the reference for:

- Eligibility
- Evidence semantics
- Scope
- Repetition
- Contradiction
- Revocation direction
- Security boundary
- Prohibition of unapproved numerical policy

`ARCH-0046-03` only answers one question:

> How can a `LearnedRule` exist before a numerical confidence policy is adopted?

Answer: `confidence` is optional.

### Future numeric policy

A numeric confidence policy may be adopted later in a separate decision. Once adopted, `confidence` may be populated at `LearnedRule` creation. This stage does **not** define:

- baseline
- repetition bonus
- threshold
- formula
- weighting
- probability interpretation

## Future Evolution

TASK-0046 implementation may resolve the open decisions through explicit contracts and tests while retaining this ADR's boundaries: explicit feedback as the primary signal, semantic learning through context, disablement, privacy controls, and non-bypassable security authorization. Future releases may separately consider richer signals or learning techniques only through a new architectural decision.

## Related Decisions

- ADR-001 and ADR-007: Event-driven architecture and synchronous in-process EventBus.
- ADR-004: Layered memory architecture.
- ADR-006: Layered prompt composition.
- ADR-003 and ADR-005: Capability-based security and tool isolation.

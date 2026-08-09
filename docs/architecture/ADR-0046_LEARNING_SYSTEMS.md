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

## Future Evolution

TASK-0046 implementation may resolve the open decisions through explicit contracts and tests while retaining this ADR's boundaries: explicit feedback as the primary signal, semantic learning through context, disablement, privacy controls, and non-bypassable security authorization. Future releases may separately consider richer signals or learning techniques only through a new architectural decision.

## Related Decisions

- ADR-001 and ADR-007: Event-driven architecture and synchronous in-process EventBus.
- ADR-004: Layered memory architecture.
- ADR-006: Layered prompt composition.
- ADR-003 and ADR-005: Capability-based security and tool isolation.

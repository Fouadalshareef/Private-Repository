# Architecture Decisions

## 1. Decision Record Format

Each decision follows this format:

- **Title**: Short decision description
- **Status**: Accepted, Rejected, Deprecated
- **Context**: Why this decision was needed
- **Decision**: What was decided
- **Alternatives Considered**: Other options and why they were rejected
- **Consequences**: Impact of this decision
- **Related Decisions**: Linked decisions

---

## 2. ADR-001: Event-Driven Architecture

**Status**: Accepted  
**Date**: 2026-08-07

### Context
The system requires loose coupling between advisors, tools, and runtime subsystems. Direct method calls create tight coupling and make testing, extension, and observability difficult.

### Decision
Adopt an event-driven architecture using a synchronous in-process EventBus. All inter-component communication flows through events.

### Alternatives Considered
1. **Direct method calls**: Rejected — creates tight coupling, hard to test
2. **Message queue (external)**: Rejected — adds external dependency, complexity
3. **Observer pattern**: Rejected — less structured than event bus

### Consequences
- **Positive**: Loose coupling, easy testing, full observability
- **Negative**: More boilerplate, harder to trace execution flow
- **Mitigation**: Provide clear event taxonomy and documentation

### Related Decisions
- ADR-002: Advisor Isolation
- ADR-005: Capability-Based Security

---

## 3. ADR-002: Advisor as Autonomous Entity

**Status**: Accepted  
**Date**: 2026-08-07

### Context
Advisors need to be independently executable, stateful, and collaborative. The current design treats advisors as simple data objects with no lifecycle or behavior.

### Decision
Treat each advisor as an autonomous entity with its own lifecycle, memory, permissions, and execution state.

### Alternatives Considered
1. **Advisors as functions**: Rejected — no state, no lifecycle
2. **Advisors as threads/processes**: Rejected — too heavy, no language support
3. **Advisors as data objects**: Rejected — no behavior encapsulation

### Consequences
- **Positive**: Clear boundaries, independent evolution, testability
- **Negative**: More complex runtime, higher memory usage
- **Mitigation**: Use efficient data structures, pool advisors

### Related Decisions
- ADR-001: Event-Driven Architecture
- ADR-004: Memory Architecture

---

## 4. ADR-003: Capability-Based Security

**Status**: Accepted  
**Date**: 2026-08-07

### Context
Traditional role-based access control (RBAC) is too coarse for advisor permissions. Advisors need fine-grained control over tools and operations.

### Decision
Adopt capability-based security where advisors are granted explicit capabilities that define what they can do.

### Alternatives Considered
1. **Role-Based Access Control (RBAC)**: Rejected — too coarse, hard to manage
2. **Attribute-Based Access Control (ABAC)**: Rejected — complex, hard to reason about
3. **Discretionary Access Control (DAC)**: Rejected — advisors would have too much power

### Consequences
- **Positive**: Fine-grained control, explicit permissions, easy audit
- **Negative**: More permission management overhead
- **Mitigation**: Provide clear permission UI and automation

### Related Decisions
- ADR-001: Event-Driven Architecture
- ADR-005: Tool Isolation

---

## 5. ADR-004: Layered Memory Architecture

**Status**: Accepted  
**Date**: 2026-08-07

### Context
Different memory types serve different purposes. A single memory store would be inefficient and hard to manage.

### Decision
Implement a multi-tiered memory architecture with separate stores for session, working, episodic, semantic, and shared memory.

### Alternatives Considered
1. **Single memory store**: Rejected — no isolation, hard to evict
2. **Database-only**: Rejected — slow, not suitable for working memory
3. **File-based**: Rejected — slow, no concurrency control

### Consequences
- **Positive**: Optimal performance per use case, clear boundaries
- **Negative**: More complex memory management
- **Mitigation**: Provide unified memory interface

### Related Decisions
- ADR-002: Advisor as Autonomous Entity

---

## 6. ADR-005: Tool Isolation via Sandbox

**Status**: Accepted  
**Date**: 2026-08-07

### Context
Tools can fail, hang, or be malicious. The runtime must protect itself and other advisors from tool failures.

### Decision
Execute tools in isolated sandboxes with resource limits, timeouts, and validation.

### Alternatives Considered
1. **No isolation**: Rejected — single failure can crash runtime
2. **Process isolation**: Rejected — too heavy, slow IPC
3. **Thread isolation**: Rejected — shared memory risks

### Consequences
- **Positive**: Fault tolerance, security, resource control
- **Negative**: Overhead, complexity
- **Mitigation**: Use lightweight sandboxing where possible

### Related Decisions
- ADR-003: Capability-Based Security

---

## 7. ADR-006: Layered Prompt Composition

**Status**: Accepted  
**Date**: 2026-08-07

### Context
Prompts need to combine system, runtime, advisor, task, project, memory, safety, and user context. A flat prompt would be unmaintainable.

### Decision
Use a layered prompt composition model where each layer adds specific context and constraints.

### Alternatives Considered
1. **Single monolithic prompt**: Rejected — hard to maintain, no separation
2. **Runtime-generated prompt**: Rejected — runtime would need LLM knowledge
3. **Advisor-generated prompt**: Rejected — advisors would need runtime knowledge

### Consequences
- **Positive**: Clear separation, reusable layers, easy testing
- **Negative**: More composition logic
- **Mitigation**: Provide clear composition rules and validation

### Related Decisions
- ADR-002: Advisor as Autonomous Entity

---

## 8. ADR-007: Synchronous In-Process EventBus

**Status**: Accepted  
**Date**: 2026-08-07

### Context
The runtime needs an event system for inter-component communication. The system is single-process, so external message queues are unnecessary.

### Decision
Use a synchronous in-process EventBus. Events are delivered synchronously to all subscribers.

### Alternatives Considered
1. **External message queue**: Rejected — unnecessary for single-process
2. **Async event bus**: Rejected — adds complexity, hard to reason about
3. **Direct calls**: Rejected — tight coupling

### Consequences
- **Positive**: Simple, fast, easy to test, deterministic
- **Negative**: Blocking delivery, single point of failure
- **Mitigation**: Keep EventBus lightweight, avoid blocking handlers

### Related Decisions
- ADR-001: Event-Driven Architecture

---

## 9. ADR-008: Immutable State

**Status**: Accepted  
**Date**: 2026-08-07

### Context
Mutable shared state causes race conditions, unpredictable behavior, and hard-to-debug issues.

### Decision
All runtime state is immutable. State transitions produce new immutable snapshots.

### Alternatives Considered
1. **Mutable state with locks**: Rejected — complex, error-prone
2. **Mutable state without locks**: Rejected — race conditions
3. **Partial immutability**: Rejected — unclear boundaries

### Consequences
- **Positive**: Predictable, thread-safe, easy to reason about
- **Negative**: More allocations, GC pressure
- **Mitigation**: Use efficient immutable data structures, object pooling

### Related Decisions
- ADR-002: Advisor as Autonomous Entity

---

## 10. ADR-009: No Global State

**Status**: Accepted  
**Date**: 2026-08-07

### Context
Global state makes testing difficult, creates hidden dependencies, and causes issues in multi-instance scenarios.

### Decision
No global state or singletons. All state is explicitly scoped and injected.

### Alternatives Considered
1. **Global singleton container**: Rejected — hidden dependencies
2. **Service locator**: Rejected — same issues as singleton
3. **Explicit dependency injection**: Accepted — clear dependencies, testable

### Consequences
- **Positive**: Testable, explicit, no hidden state
- **Negative**: More boilerplate, longer initialization
- **Mitigation**: Provide clear DI patterns and helpers

### Related Decisions
- ADR-008: Immutable State

---

## 11. ADR-010: Explicit Context Flow

**Status**: Accepted  
**Date**: 2026-08-07

### Context
Hidden context flow makes reasoning about the system difficult and causes bugs.

### Decision
Context flows explicitly through the system via parameters and events. No hidden global context.

### Alternatives Considered
1. **Global context store**: Rejected — hidden dependencies
2. **Thread-local context**: Rejected — hard to test, unclear boundaries
3. **Explicit context passing**: Accepted — clear, testable

### Consequences
- **Positive**: Clear data flow, easy to test, no surprises
- **Negative**: More parameters, longer call chains
- **Mitigation**: Use context objects to group related parameters

### Related Decisions
- ADR-001: Event-Driven Architecture

---

## 12. Future Decisions (Deferred)

These decisions are deferred to later phases:

| Decision | Deferred To | Reason |
|----------|-------------|--------|
| Vector database selection | TASK-003X | Not needed in Phase 1 |
| Plugin sandbox technology | TASK-003X | Not needed in Phase 1 |
| Multi-instance clustering | TASK-003X | Single-instance in Phase 1 |
| GUI framework | TASK-003X | CLI only in Phase 1 |
| LLM provider abstraction details | TASK-003X | Mock provider in Phase 1 |

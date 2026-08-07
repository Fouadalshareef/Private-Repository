# Cupaw Runtime Architecture

## 1. Vision Statement

Cupaw is not a chatbot. It is not a CLI. It is not an IDE assistant.

**Cupaw is an AI Operating System for Collaborative AI Agents.**

This distinction shapes every architectural decision in this document. The runtime must support:

- Multiple autonomous advisors operating concurrently
- Structured collaboration between advisors
- Persistent memory across sessions and advisors
- Tool execution with strict isolation and audit
- Event-driven communication with deterministic ordering
- Multi-LLM provider support without vendor lock-in
- Extensibility through plugins and advisors

## 2. What is Cupaw Runtime?

Cupaw Runtime is the **operating system layer** that manages the lifecycle, communication, memory, and execution of AI advisors. It is the platform on which advisors operate, analogous to how an OS manages processes.

The runtime provides:

- **Process Management**: Advisor lifecycle (create, activate, suspend, resume, dispose)
- **Memory Management**: Session, working, episodic, semantic, and shared team memory
- **IPC (Inter-Process Communication)**: Event bus for advisor-to-advisor communication
- **Resource Management**: Tool execution, timeouts, retries, sandboxing
- **Security**: Capability-based permissions, session isolation, audit logging
- **Scheduling**: Execution planning, priority, concurrency control

## 3. What is NOT the Runtime's Responsibility?

The runtime does **not**:

- Implement advisor logic or behavior
- Define advisor prompts or knowledge
- Make domain-specific decisions
- Expose a user interface
- Manage LLM provider selection or configuration
- Store project-specific data permanently

These are responsibilities of Advisors, Plugins, and external systems.

## 4. Runtime Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                      Cupaw Runtime                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Advisor   │  │   Memory    │  │     Tool Engine     │ │
│  │  Runtime    │  │  Subsystem  │  │     Subsystem       │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────────▼──────────┐ │
│  │   Event     │  │   Context   │  │   Security &        │ │
│  │    Bus      │  │   Manager   │  │   Authorization     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │                    │                     │
         ▼                    ▼                     ▼
┌───────────────┐  ┌───────────────────┐  ┌───────────────────┐
│  Advisors     │  │   Memory Stores   │  │   Tools / Sandbox │
│  (Entities)   │  │                   │  │                   │
└───────────────┘  └───────────────────┘  └───────────────────┘
```

### 4.1 Internal Boundaries

| Boundary | Responsibility | Interface |
|----------|---------------|-----------|
| Runtime ↔ Advisors | Lifecycle, state machine, event subscription | `IAdvisorRuntime` |
| Runtime ↔ Memory | Session CRUD, context flow, memory operations | `IMemoryManager` |
| Runtime ↔ Tools | Tool registration, execution, timeout, retry | `IToolEngine` |
| Runtime ↔ Events | Publish/subscribe, event routing | `IEventBus` |
| Runtime ↔ Security | Authorization, session validation, audit | `ISecurityEngine` |
| Runtime ↔ LLM Providers | Provider abstraction, streaming, completion | `ILLMProvider` |

### 4.2 External Boundaries

| External System | Boundary | Communication |
|----------------|----------|---------------|
| LLM Providers | Runtime → Provider | Provider interface (stream/completion) |
| UI / CLI | Runtime ↔ UI | CLI handler, API layer (future) |
| Filesystem / Workspace | Runtime → FS | Tool execution sandbox |
| Plugins | Runtime ↔ Plugin | Plugin registry, lifecycle hooks |
| External Services | Runtime → Service | Tool-based integration |

## 5. Core Runtime Principles

### 5.1 Immutability First

All runtime state transitions produce new immutable snapshots. No mutable shared state between advisors.

### 5.2 Event-Driven Communication

All inter-component communication uses events. No direct method calls between advisors.

### 5.3 Capability-Based Security

Advisors and tools have explicit capabilities. No implicit permissions.

### 5.4 Explicit Context

Context flows explicitly through the system. No hidden global state.

### 5.5 Composition Over Inheritance

Runtime behavior is composed from subsystems, not inherited from base classes.

## 6. Runtime Component Model

```
Runtime
├── AdvisorRuntime
│   ├── LifecycleManager
│   ├── StateMachine
│   └── EventDispatcher
├── MemoryManager
│   ├── SessionMemory
│   ├── WorkingMemory
│   ├── EpisodicMemory
│   └── SemanticMemory
├── ToolEngine
│   ├── ToolRegistry
│   ├── ToolExecutor
│   ├── ToolScheduler
│   └── SandboxManager
├── EventBus
│   ├── Publisher
│   ├── Subscriber
│   ├── Router
│   └── ReplayBuffer
├── SecurityEngine
│   ├── SessionSecurity
│   ├── AdvisorPermissions
│   └── ToolPermissions
├── ContextManager
│   ├── ContextBuilder
│   └── ContextTrimmer
├── PromptEngine
│   ├── TemplateRenderer
│   ├── Composer
│   └── Validator
├── LLMProviderInterface
│   ├── ProviderFactory
│   ├── StreamManager
│   └── CompletionManager
└── PluginSystem
    ├── PluginRegistry
    ├── PluginLoader
    └── PluginLifecycle
```

## 7. Non-Negotiable Constraints

1. **Zero external runtime dependencies** for the core runtime
2. **No global state or singletons** — all state is explicitly scoped
3. **No implicit communication** — all IPC via EventBus
4. **No tool execution without authorization** — capability checks are mandatory
5. **No mutable shared memory** — all memory operations produce immutable snapshots
6. **No LLM calls in the runtime** — runtime only coordinates, never reasons
7. **No UI logic in the runtime** — UI is a plugin/consumer of runtime events

## 8. Success Criteria

The runtime is successful when:

- A new advisor can be added without modifying runtime code
- Multiple advisors can collaborate without direct references
- Tools can be added/removed without restarting advisors
- Memory can be swapped (in-memory → database) without changing advisor code
- LLM providers can be swapped without changing advisor code
- The system can scale from 1 advisor to 100 advisors with no architectural changes

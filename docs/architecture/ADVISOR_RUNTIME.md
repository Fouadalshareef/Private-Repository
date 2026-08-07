# Advisor Runtime Architecture

## 1. Core Concept

Every Advisor in Cupaw is a **first-class autonomous entity**. The Advisor Runtime is the container that gives an advisor its identity, lifecycle, memory, permissions, and execution environment.

An Advisor is **not**:
- A function
- A prompt template
- A routing rule
- A configuration object

An Advisor **is**:
- An autonomous entity with its own lifecycle
- A memory-owning process
- A permission-scoped tool user
- An event-emitting and event-consuming participant
- A collaborative agent in a multi-agent system

## 2. Advisor Identity Model

Every advisor has a **complete, immutable identity profile**:

```typescript
interface AdvisorIdentity {
  id: AdvisorId;                    // Unique, immutable
  name: string;                     // Human-readable
  role: AdvisorRole;                // System role classification
  specialty: string;                // Domain expertise
  description: string;              // Public description
  version: string;                  // Semantic version of advisor definition
  createdAt: number;                // Timestamp
  owner: string;                    // Plugin or system that owns this advisor
}
```

## 3. Advisor Runtime Model

Each advisor instance carries a **runtime state envelope**:

```typescript
interface AdvisorRuntimeState {
  identity: AdvisorIdentity;
  systemPrompt: string;             // Immutable, versioned
  goals: readonly string[];         // Current objectives
  policies: AdvisorPolicies;        // Tool, context, and behavior policies
  context: AdvisorContext;          // Working context (mutable)
  workingMemory: WorkingMemory;     // Short-term scratchpad
  longTermMemory?: LongTermMemory;  // Persistent memory (future)
  toolPermissions: ToolPermissionSet; // Capability-based permissions
  planner: Planner;                 // Internal planning engine
  eventSubscriptions: readonly string[]; // Subscribed event types
  knowledgeSources: readonly KnowledgeSource[]; // External knowledge
  capabilities: readonly AdvisorCapability[]; // What this advisor can do
  conversationState: ConversationState; // Current conversation
  runtimeState: AdvisorRuntimeStatus; // Lifecycle state
}
```

## 4. Advisor Lifecycle State Machine

```
                 +----------------+
                 |    Created     |
                 +--------+-------+
                          |
                          v
                 +----------------+
                 |  Initialized   |
                 +--------+-------+
                          |
                          v
                 +----------------+
                 |    Activated    |
                 +--------+-------+
                          |
                          v
                 +----------------+
                 |     Busy       │◄────┐
                 +--------+-------+     │
                          │             │
                          v             │
                 +----------------+     │
                 |    Waiting     │     │
                 +--------+-------+     │
                          │             │
                          v             │
                 +----------------+     │
                 |   Suspended    │─────┘
                 +--------+-------+
                          |
                          v
                 +----------------+
                 |     Stopped     │
                 +--------+-------+
                          |
                          v
                 +----------------+
                 |    Disposed    │
                 +----------------+
```

### 4.1 State Descriptions

| State | Description | Allowed Operations |
|-------|-------------|-------------------|
| Created | Advisor instance created, not yet initialized | initialize() |
| Initialized | Prompt loaded, memory allocated, subscriptions registered | activate() |
| Activated | Ready to receive messages | execute(), suspend() |
| Busy | Executing a task | complete(), fail() |
| Waiting | Waiting for external input or tool result | resume(), suspend() |
| Suspended | Temporarily inactive, state preserved | resume(), dispose() |
| Stopped | Gracefully stopped, state can be persisted | dispose() |
| Disposed | Permanently removed, resources freed | — |

### 4.2 State Transitions

```
Created → Initialized → Activated ↔ Busy ↔ Waiting ↔ Suspended → Stopped → Disposed
```

**Valid transitions only. All other transitions are rejected by the Runtime.**

## 5. Advisor Internal Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Advisor Runtime Envelope                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Identity Layer                                        ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    ││
│  │  │ AdvisorId   │  │  Role       │  │ Version     │    ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘    ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Execution Layer                                       ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    ││
│  │  │  Planner    │  │  Executor   │  │  Reflector  │    ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘    ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Memory Layer                                          ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    ││
│  │  │WorkingMemory│  │LongTermMem  │  │Conversation │    ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘    ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Policy Layer                                          ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    ││
│  │  │ToolPerms    │  │ContextPerms │  │SafetyRules  │    ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘    ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Communication Layer                                   ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    ││
│  │  │EventSub     │  │MsgQueue     │  │PubSub       │    ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 5.1 Identity Layer

- **AdvisorId**: Branded type, immutable
- **Role**: Classification for routing and permissions
- **Version**: Semantic version of advisor definition
- **Owner**: Plugin or system identifier

### 5.2 Execution Layer

- **Planner**: Breaks goals into executable tasks
- **Executor**: Runs tasks, handles tool calls, manages loops
- **Reflector**: Evaluates execution results, updates plans

### 5.3 Memory Layer

- **Working Memory**: Active scratchpad, cleared between tasks
- **Long-Term Memory**: Persistent knowledge (future)
- **Conversation State**: Current conversation history

### 5.4 Policy Layer

- **Tool Permissions**: Capability-based tool access
- **Context Permissions**: What context this advisor can see
- **Safety Rules**: Hard constraints (no destructive actions, etc.)

### 5.5 Communication Layer

- **Event Subscriptions**: Types of events this advisor listens to
- **Message Queue**: Outgoing messages to other advisors
- **PubSub**: Publish/subscribe for broadcast communication

## 6. Advisor Goals and Planning

Every advisor operates with explicit **goals**:

```typescript
interface AdvisorGoal {
  id: string;
  description: string;
  priority: number;                // Higher = more important
  status: GoalStatus;              // Pending, Active, Completed, Failed
  parentGoalId?: string;           // Hierarchical goals
  acceptanceCriteria: readonly string[];
}
```

The **Planner** inside each advisor:

1. Receives user input or collaboration request
2. Decomposes into sub-goals
3. Assigns tools and context to each sub-goal
4. Executes in sequence or parallel
5. Reflects on results
6. Updates goals and replans if needed

## 7. Advisor Policies

Policies are **immutable constraints** that govern advisor behavior:

```typescript
interface AdvisorPolicies {
  maxToolCallsPerTurn: number;
  maxConcurrentTasks: number;
  allowedTools: readonly string[];
  forbiddenTools: readonly string[];
  maxContextTokens: number;
  requiresHumanApproval: boolean;
  canDelegateTo: readonly AdvisorId[];
  canReceiveDelegations: boolean;
  isolationLevel: IsolationLevel;  // None, Sandbox, Strict
}
```

Policies are enforced by the Runtime, not the advisor. The Runtime validates every action against the advisor's policies before execution.

## 8. Advisor Capabilities

Capabilities are **declared abilities** that advisors expose to the system:

```typescript
interface AdvisorCapability {
  id: string;
  name: string;
  description: string;
  category: CapabilityCategory;    // Analysis, Creation, Review, etc.
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
}
```

Capabilities are used for:
- Advisor discovery
- Collaboration matching
- Tool permission derivation
- Capability-based routing

## 9. Knowledge Sources

Advisors can declare external knowledge sources:

```typescript
interface KnowledgeSource {
  id: string;
  type: 'file' | 'database' | 'api' | 'vector' | 'workspace';
  location: string;
  accessPattern: 'read' | 'write' | 'readwrite';
  refreshStrategy?: 'manual' | 'periodic' | 'event';
}
```

The Runtime ensures knowledge sources are accessible according to the advisor's permissions and isolation level.

## 10. Advisor Event Contract

Advisors communicate exclusively through events:

```typescript
// Outgoing events (produced by advisor)
type AdvisorEvent =
  | { type: 'advisor.task.started'; payload: { taskId: string } }
  | { type: 'advisor.task.completed'; payload: { taskId: string; result: unknown } }
  | { type: 'advisor.task.failed'; payload: { taskId: string; error: string } }
  | { type: 'advisor.message.sent'; payload: { to: AdvisorId; message: unknown } }
  | { type: 'advisor.state.changed'; payload: { from: State; to: State } }
  | { type: 'advisor.delegation.requested'; payload: { to: AdvisorId; task: Task } };

// Incoming events (consumed by advisor)
type AdvisorIncomingEvent =
  | { type: 'advisor.message.received'; payload: { from: AdvisorId; message: unknown } }
  | { type: 'advisor.delegation.received'; payload: { from: AdvisorId; task: Task } }
  | { type: 'advisor.context.updated'; payload: { context: AdvisorContext } }
  | { type: 'runtime.pause.requested'; payload: {} }
  | { type: 'runtime.resume.requested'; payload: {} };
```

## 11. Advisor-System Boundary

The Runtime enforces strict boundaries:

```
┌──────────────────────────────────────┐
│          Advisor Runtime             │
│  ┌────────────────────────────────┐  │
│  │  Advisor Internal World        │  │
│  │  - Goals, Plans, Reflections    │  │
│  │  - Working Memory              │  │
│  │  - Internal State              │  │
│  └────────────────────────────────┘  │
│                    │                 │
│  ┌────────────────────────────────┐  │
│  │  Runtime Facade                │  │
│  │  - validateAction()            │  │
│  │  - checkPermissions()          │  │
│  │  - publishEvent()              │  │
│  │  - requestTool()               │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

The **Runtime Facade** is the only interface an advisor has to the outside world. Direct access to Runtime internals is impossible.

## 12. Future Considerations

- **Long-Term Memory**: Persistent storage per advisor (database-backed)
- **Knowledge Graphs**: Structured knowledge representation
- **Learning**: Advisor self-improvement through reflection
- **Delegation Chains**: Multi-hop task delegation between advisors
- **Checkpoint/Restore**: Serialize and restore advisor state

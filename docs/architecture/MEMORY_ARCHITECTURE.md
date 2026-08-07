# Memory Architecture

## 1. Vision

Memory in Cupaw is not a simple message log. It is a **multi-tiered cognitive architecture** that mirrors human memory systems:

- **Short-term**: Active working memory (scratchpad)
- **Episodic**: Conversation history and experiences
- **Semantic**: Learned knowledge and patterns
- **Procedural**: Tool usage patterns and preferences (future)
- **Shared**: Team/group memory in multi-agent sessions

## 2. Memory Taxonomy

```
┌─────────────────────────────────────────────────────────────┐
│                     Cupaw Memory System                      │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                Short-Term Memory                       │   │
│  │  ┌─────────────────┐  ┌─────────────────────────┐    │   │
│  │  │  Working Memory │  │       Scratchpad        │    │   │
│  │  │  (per advisor)  │  │   (per task/execution)  │    │   │
│  │  └─────────────────┘  └─────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                Long-Term Memory                        │   │
│  │  ┌─────────────────┐  ┌─────────────────────────┐    │   │
│  │  │ Episodic Memory │  │   Semantic Memory        │    │   │
│  │  │ (conversations) │  │   (learned knowledge)    │    │   │
│  │  └─────────────────┘  └─────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                Specialized Memory                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │   Project   │  │Tool Memory  │  │  User       │  │   │
│  │  │   Memory    │  │(execution   │  │  Memory     │  │   │
│  │  │             │  │  patterns)  │  │             │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                Shared Memory                            │   │
│  │  ┌───────────────────────────────────────────────┐    │   │
│  │  │         Shared Team Memory                    │    │   │
│  │  │  (collaborative context across advisors)      │    │   │
│  │  └───────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                Future Memory                            │   │
│  │  ┌───────────────────────────────────────────────┐    │   │
│  │  │            Vector Memory                      │    │   │
│  │  │  (semantic search, embeddings)                │    │   │
│  │  └───────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 3. Memory Types

### 3.1 Session Memory

**Scope**: Single conversation session  
**Lifetime**: Session duration  
**Owner**: ConversationMemory subsystem  
**Storage**: In-memory Map (current), database (future)

Stores:
- Message history (user, assistant, tool, system)
- Session metadata
- Context window snapshots

```typescript
interface SessionMemory {
  sessionId: string;
  messages: readonly AIMessage[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Readonly<Record<string, unknown>>;
}
```

### 3.2 Working Memory

**Scope**: Single advisor, current task  
**Lifetime**: Task duration  
**Owner**: Individual Advisor  
**Storage**: In-memory within advisor runtime

Stores:
- Active goals
- Current plan
- Intermediate results
- Scratch calculations
- Temporary context

```typescript
interface WorkingMemory {
  advisorId: AdvisorId;
  taskId: string;
  goals: readonly AdvisorGoal[];
  currentPlan?: Plan;
  scratchpad: Readonly<Record<string, unknown>>;
  createdAt: number;
  expiresAt?: number;
}
```

### 3.3 Scratchpad

**Scope**: Single tool execution or reasoning step  
**Lifetime**: Execution step duration  
**Owner**: AgentExecutor or ToolExecutor  
**Storage**: In-memory, transient

Stores:
- Tool arguments
- Intermediate calculations
- Reasoning traces
- Validation results

### 3.4 Knowledge Memory

**Scope**: Advisor-specific knowledge  
**Lifetime**: Permanent (until explicitly updated)  
**Owner**: Advisor  
**Storage**: File system, database, or vector store (future)

Stores:
- Learned patterns
- Domain knowledge
- Best practices
- Historical decisions

### 3.5 Project Memory

**Scope**: Entire project  
**Lifetime**: Project lifetime  
**Owner**: Runtime (shared)  
**Storage**: Project workspace

Stores:
- Project structure
- Code patterns
- Dependencies
- Configuration
- Team conventions

### 3.6 Semantic Memory

**Scope**: System-wide learned knowledge  
**Lifetime**: Permanent  
**Owner**: Runtime  
**Storage**: Vector database (future)

Stores:
- Embeddings of conversations
- Knowledge graph
- Concept relationships
- Similarity search index

### 3.7 Episodic Memory

**Scope**: All conversations and experiences  
**Lifetime**: Permanent  
**Owner**: Runtime  
**Storage**: Database (future)

Stores:
- Conversation transcripts
- Decision history
- Tool execution patterns
- Success/failure patterns

### 3.8 Vector Memory (Future)

**Scope**: Semantic search across all memory types  
**Lifetime**: Permanent  
**Owner**: Runtime  
**Storage**: Vector database

Provides:
- Similarity search
- Concept retrieval
- Knowledge graph traversal
- Semantic recall

### 3.9 Shared Team Memory

**Scope**: Multi-agent collaboration sessions  
**Lifetime**: Session duration  
**Owner**: Runtime  
**Storage**: In-memory, shared context object

Stores:
- Shared decisions
- Common context
- Team agreements
- Shared artifacts

### 3.10 User Memory

**Scope**: User-specific preferences and history  
**Lifetime**: Permanent  
**Owner**: Runtime  
**Storage**: User profile store (future)

Stores:
- User preferences
- Interaction history
- Feedback
- Customizations

### 3.11 Tool Memory

**Scope**: Tool execution history  
**Lifetime**: Configurable  
**Owner**: ToolEngine  
**Storage**: In-memory with optional persistence

Stores:
- Execution results
- Performance metrics
- Error patterns
- Usage statistics

## 4. Memory Operations

All memory operations follow these rules:

1. **Immutable writes**: Every write creates a new version, never modifies existing
2. **Explicit reads**: All reads are explicit, no implicit memory access
3. **Bounded scope**: Memory is scoped to session/advisor/task
4. **Explicit sharing**: Memory is only shared via explicit context passing
5. **Automatic cleanup**: Expired memory is automatically evicted

```typescript
interface MemoryOperations {
  read<T>(key: string, scope: MemoryScope): Promise<T | undefined>;
  write<T>(key: string, value: T, scope: MemoryScope): Promise<void>;
  delete(key: string, scope: MemoryScope): Promise<void>;
  list(scope: MemoryScope): Promise<readonly string[]>;
  clear(scope: MemoryScope): Promise<void>;
  evictExpired(): Promise<number>;
}
```

## 5. Memory Isolation

Memory is strictly isolated by scope:

| Scope | Visible To | Access |
|-------|-----------|--------|
| Session | Participants in session | Read-write |
| Advisor | Single advisor | Read-write |
| Task | Executing task | Read-write |
| Runtime | Runtime subsystems | Read-write |
| Shared | Explicitly granted advisors | Read-only or read-write |
| System | All advisors | Read-only |

## 6. Memory Flow

```
User Input
    │
    ▼
Session Memory (store user message)
    │
    ▼
Advisor Working Memory (load context)
    │
    ▼
Planner (reason about task)
    │
    ▼
Tool Execution (use scratchpad)
    │
    ▼
Episodic Memory (store experience)
    │
    ▼
Semantic Memory (extract knowledge)
    │
    ▼
Final Response
```

## 7. Memory Persistence Strategy

| Memory Type | Persistence | Strategy |
|-------------|-------------|----------|
| Session Memory | In-memory | Auto-expire after TTL |
| Working Memory | In-memory | Auto-expire after task |
| Scratchpad | In-memory | Auto-expire after execution |
| Knowledge Memory | File system | Manual + periodic sync |
| Project Memory | Workspace | Persisted |
| Episodic Memory | Database (future) | Append-only |
| Semantic Memory | Vector DB (future) | Incremental updates |
| Shared Team Memory | In-memory | Session-scoped |
| User Memory | User store (future) | Manual + incremental |

## 8. Memory Security

- **Session isolation**: Sessions cannot access other sessions' memory
- **Advisor isolation**: Advisors cannot access other advisors' working memory
- **Explicit sharing**: Memory sharing requires explicit grant
- **Audit trail**: All memory access is logged
- **Encryption**: Sensitive memory is encrypted at rest (future)

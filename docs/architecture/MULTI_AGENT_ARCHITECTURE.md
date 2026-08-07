# Multi-Agent Collaboration Architecture

## 1. Core Principles

Multi-agent collaboration in Cupaw follows three principles:

1. **No direct references**: Advisors never hold references to other advisors
2. **Event-based communication**: All inter-advisor communication via Runtime EventBus
3. **Explicit context sharing**: Shared context is explicitly passed, never implicitly accessed

## 2. Communication Topology

```
┌─────────────────────────────────────────────────────────────┐
│                    Cupaw Runtime EventBus                   │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Architect  │  │    UI       │  │   Backend   │        │
│  │  Advisor    │  │  Designer   │  │  Engineer   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │
│         └────────────────┼────────────────┘                │
│                          │                                  │
│                    ┌─────▼─────┐                           │
│                    │  Runtime  │                           │
│                    │  Router   │                           │
│                    └───────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Communication Patterns

| Pattern | Description | Use Case |
|---------|-------------|----------|
| **Request-Response** | Advisor A sends task, Advisor B responds | Delegation, consultation |
| **Broadcast** | One advisor publishes to all | Status updates, announcements |
| **Private Message** | Direct message between two advisors | Sensitive coordination |
| **Group Session** | Multiple advisors in a shared context | Design reviews, architecture decisions |
| **Shared Context** | Common context object accessible by group | Project-wide state |

## 3. Message Protocol

All inter-advisor messages follow this protocol:

```typescript
interface AdvisorMessage {
  messageId: string;
  from: AdvisorId;
  to: AdvisorId | 'broadcast' | 'group:<groupId>';
  timestamp: number;
  type: MessageType;
  payload: unknown;
  correlationId?: string;           // For request-response correlation
  priority: MessagePriority;        // Low, Normal, High, Critical
  ttl?: number;                     // Time-to-live in ms
  metadata: Readonly<Record<string, string>>;
}

type MessageType =
  | 'request'           // Request for action
  | 'response'          // Response to request
  | 'broadcast'         // Broadcast to all
  | 'private'           // Private message
  | 'delegation'        // Task delegation
  | 'collaboration'     // Collaboration invitation
  | 'status'            // Status update
  | 'error';            // Error notification
```

## 4. Collaboration Session Model

A **Collaboration Session** is a bounded context where multiple advisors work together:

```typescript
interface CollaborationSession {
  sessionId: string;
  participants: readonly AdvisorId[];
  facilitator: AdvisorId;           // Leads the session
  topic: string;
  context: SharedContext;           // Explicit shared context
  status: SessionStatus;
  createdAt: number;
  endedAt?: number;
  decisions: readonly Decision[];   // Decisions made in session
}
```

### 4.1 Session Lifecycle

```
Created → Active → Paused → Resumed → Ended → Archived
```

### 4.2 Session Types

| Type | Description | Participants |
|------|-------------|--------------|
| **Design Review** | Review and approve designs | UI, Backend, Architect |
| **Architecture Decision** | Make architectural decisions | Architect, relevant advisors |
| **Implementation** | Execute a feature plan | Implementer, QA |
| **Debugging** | Diagnose and fix issues | Implementer, QA, Security |
| **Planning** | Plan and estimate work | Architect, Implementer, QA |

## 5. Decision Making

### 5.1 Decision Model

```typescript
interface Decision {
  decisionId: string;
  sessionId: string;
  topic: string;
  options: readonly DecisionOption[];
  selectedOption?: DecisionOption;
  participants: readonly AdvisorId[];
  consensus: ConsensusResult;
  timestamp: number;
}

interface DecisionOption {
  id: string;
  description: string;
  rationale: string;
  risks: readonly string[];
  proposedBy: AdvisorId;
  votes: readonly Vote[];
}

interface Vote {
  advisorId: AdvisorId;
  optionId: string;
  weight: number;                   // Based on advisor role/expertise
  rationale?: string;
}

interface ConsensusResult {
  type: 'unanimous' | 'majority' | 'facilitator' | 'none';
  confidence: number;               // 0-1
  dissenting?: readonly { advisorId: AdvisorId; reason: string }[];
}
```

### 5.2 Decision Protocols

| Protocol | Description | Use Case |
|----------|-------------|----------|
| **Unanimous** | All participants agree | Critical decisions |
| **Majority** | >50% agree | Standard decisions |
| **Facilitator** | Session leader decides | Time-constrained decisions |
| **None** | No consensus reached | Escalate to human |

## 6. Conflict Resolution

When advisors disagree:

1. **Escalate to Facilitator**: The session facilitator makes the final call
2. **Weighted Voting**: Advisors with higher expertise weight have more influence
3. **Time-limited Deliberation**: If no consensus within time limit, facilitator decides
4. **Human Escalation**: If facilitator cannot decide, escalate to user

```typescript
interface ConflictResolution {
  conflictId: string;
  topic: string;
  participants: readonly AdvisorId[];
  positions: readonly { advisorId: AdvisorId; position: string }[];
  resolution: 'facilitator' | 'human' | 'deferred';
  decidedBy?: AdvisorId;
  rationale: string;
}
```

## 7. Context Sharing

### 7.1 Shared Context Model

```typescript
interface SharedContext {
  contextId: string;
  sessionId: string;
  data: Readonly<Record<string, unknown>>;
  version: number;                  // Incremented on each update
  updatedBy: AdvisorId;
  updatedAt: number;
  accessControl: readonly AdvisorId[]; // Who can read/write
}
```

### 7.2 Context Propagation

```
Advisor A updates context
        │
        ▼
Runtime validates write permission
        │
        ▼
Context version incremented
        │
        ▼
Event: context.updated published to session participants
        │
        ▼
Participants receive new context version
        │
        ▼
Participants update their working memory
```

### 7.3 Context Isolation Rules

| Rule | Description |
|------|-------------|
| **Read Isolation** | Advisor can only read context it has access to |
| **Write Isolation** | Advisor can only write to context it owns or has write access to |
| **Versioning** | Every context change creates a new version |
| **TTL** | Context entries can have time-to-live |
| **Size Limits** | Maximum context size enforced by Runtime |

## 8. Group Session Protocol

### 8.1 Starting a Group Session

```
User Request
    │
    ▼
Runtime creates CollaborationSession
    │
    ▼
Runtime selects participants based on:
  - Topic relevance
  - Advisor capabilities
  - Current availability
    │
    ▼
Facilitator assigned (highest role priority)
    │
    ▼
Participants activated and context distributed
    │
    ▼
Session begins
```

### 8.2 During Session

- **Turn-based**: Each participant speaks in turn (facilitator-managed)
- **Free-form**: Participants can interject (event-driven)
- **Delegation**: Participants can delegate tasks to external advisors
- **Voting**: Decisions put to vote when consensus needed

### 8.3 Ending Session

- **Natural End**: All tasks completed, decisions made
- **Time-limited**: Session expires after configured time
- **User-initiated**: User manually ends session
- **Error**: Unrecoverable error terminates session

After session ends:
1. Decisions are persisted
2. Context is archived
3. Participants return to idle/waiting state
4. Session history is recorded in memory

## 9. Example: Feature Development Session

```
User: "Build a new login feature"

1. Runtime creates CollaborationSession
   Topic: "Design login feature"
   Participants: Architect, Backend, Frontend, QA, Docs

2. Facilitator (Architect) opens session
   "We need to design a secure login feature. Backend, start with API design."

3. Backend proposes REST API endpoints
   Publishes to: collaboration.session.message

4. Frontend reviews and proposes UI components
   Publishes to: collaboration.session.message

5. QA raises security concerns
   Publishes to: collaboration.session.message

6. Architect synthesizes and makes decisions
   Creates Decision record

7. Docs begins documentation in parallel

8. Session ends when all decisions made
   Decisions persisted to memory
```

## 10. Anti-Patterns to Avoid

| Anti-Pattern | Why Bad | Correct Approach |
|--------------|---------|------------------|
| Direct advisor-to-advisor calls | Breaks isolation, tight coupling | EventBus only |
| Shared mutable state | Race conditions, unpredictable behavior | Immutable shared context |
| Circular dependencies | Deadlocks, infinite loops | Directed acyclic graph |
| Unbounded sessions | Resource exhaustion | Time limits, max participants |
| Silent failures | Lost decisions, incomplete state | Explicit error events |

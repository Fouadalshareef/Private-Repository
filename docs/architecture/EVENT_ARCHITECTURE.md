# Event Architecture

## 1. Vision

The Cupaw Runtime is an **event-driven system**. Every significant action, state change, and communication is expressed as an event. This enables:

- **Loose coupling**: Components communicate via events, not direct calls
- **Observability**: All system activity is visible through events
- **Extensibility**: New components can subscribe to existing events
- **Auditability**: Complete history of system activity
- **Replayability**: Events can be replayed for debugging or recovery

## 2. Event Bus Design

### 2.1 Core Bus

The EventBus is a synchronous, in-process, publish-subscribe system:

```
Publisher → EventBus → Subscriber(s)
```

**Properties**:
- **Synchronous**: Events are delivered synchronously to all subscribers
- **In-process**: No network overhead, no serialization
- **Type-safe**: Events are strongly typed
- **Ordered**: Events are delivered in publication order
- **Isolated**: EventBus instances are scoped to Runtime

### 2.2 Event Structure

```typescript
interface Event<TPayload = unknown> {
  id: string;                      // Unique event ID
  type: string;                    // Event type (namespaced)
  timestamp: number;               // Unix timestamp
  payload: TPayload;               // Event data
  metadata: EventMetadata;         // Correlation, causation, etc.
}

interface EventMetadata {
  correlationId?: string;          // Links related events
  causationId?: string;            // Event that caused this
  source: string;                  // Component that published
  version: string;                 // Event schema version
  priority: EventPriority;         // Low, Normal, High, Critical
}
```

## 3. Event Taxonomy

### 3.1 Domain Events

Events that represent significant domain occurrences:

```typescript
type DomainEvent =
  | { type: 'advisor.created'; payload: { advisorId: AdvisorId } }
  | { type: 'advisor.activated'; payload: { advisorId: AdvisorId } }
  | { type: 'advisor.suspended'; payload: { advisorId: AdvisorId } }
  | { type: 'advisor.disposed'; payload: { advisorId: AdvisorId } }
  | { type: 'session.created'; payload: { sessionId: string } }
  | { type: 'session.ended'; payload: { sessionId: string } }
  | { type: 'tool.executed'; payload: { toolName: string; success: boolean } }
  | { type: 'decision.made'; payload: { decisionId: string; consensus: ConsensusResult } };
```

### 3.2 Runtime Events

Events that represent runtime state changes:

```typescript
type RuntimeEvent =
  | { type: 'runtime.started'; payload: { version: string } }
  | { type: 'runtime.stopping'; payload: { reason: string } }
  | { type: 'runtime.stopped'; payload: {} }
  | { type: 'runtime.error'; payload: { error: string; recoverable: boolean } }
  | { type: 'subsystem.initialized'; payload: { subsystem: string } }
  | { type: 'subsystem.error'; payload: { subsystem: string; error: string } };
```

### 3.3 Advisor Events

Events related to advisor lifecycle and behavior:

```typescript
type AdvisorEvent =
  | { type: 'advisor.task.started'; payload: { advisorId: AdvisorId; taskId: string } }
  | { type: 'advisor.task.completed'; payload: { advisorId: AdvisorId; taskId: string } }
  | { type: 'advisor.task.failed'; payload: { advisorId: AdvisorId; taskId: string; error: string } }
  | { type: 'advisor.state.changed'; payload: { advisorId: AdvisorId; from: State; to: State } }
  | { type: 'advisor.message.sent'; payload: { from: AdvisorId; to: AdvisorId } }
  | { type: 'advisor.message.received'; payload: { from: AdvisorId; to: AdvisorId } }
  | { type: 'advisor.delegation.requested'; payload: { from: AdvisorId; to: AdvisorId } }
  | { type: 'advisor.delegation.completed'; payload: { from: AdvisorId; to: AdvisorId } };
```

### 3.4 Tool Events

Events related to tool execution:

```typescript
type ToolEvent =
  | { type: 'tool.registered'; payload: { toolName: string } }
  | { type: 'tool.unregistered'; payload: { toolName: string } }
  | { type: 'tool.executing'; payload: { toolName: string; callId: string } }
  | { type: 'tool.executed'; payload: { toolName: string; callId: string; success: boolean; durationMs: number } }
  | { type: 'tool.failed'; payload: { toolName: string; callId: string; error: string } }
  | { type: 'tool.timeout'; payload: { toolName: string; callId: string; timeoutMs: number } };
```

### 3.5 Session Events

Events related to conversation sessions:

```typescript
type SessionEvent =
  | { type: 'session.created'; payload: { sessionId: string; advisorId?: AdvisorId } }
  | { type: 'session.ended'; payload: { sessionId: string } }
  | { type: 'session.cleared'; payload: { sessionId: string } }
  | { type: 'session.context.updated'; payload: { sessionId: string; keys: string[] } };
```

### 3.6 Project Events

Events related to project state:

```typescript
type ProjectEvent =
  | { type: 'project.loaded'; payload: { projectId: string } }
  | { type: 'project.updated'; payload: { projectId: string; changes: string[] } }
  | { type: 'project.file.changed'; payload: { projectId: string; filePath: string } }
  | { type: 'project.decision.made'; payload: { projectId: string; decisionId: string } };
```

## 4. Event Communication Patterns

### 4.1 Request-Response

```
Advisor A                    Runtime                    Advisor B
    │                          │                            │
    │───advisor.task.request──>│                            │
    │                          │───advisor.task.requested──>│
    │                          │                            │
    │                          │<──advisor.task.accepted────│
    │<──advisor.task.accepted─│                            │
    │                          │                            │
    │<──advisor.task.result───│                            │
    │                          │<──advisor.task.completed───│
    │                          │                            │
```

**Correlation**: `correlationId` links request to response

### 4.2 Broadcast

```
Runtime ────event────> Advisor A
         ────event────> Advisor B
         ────event────> Advisor C
         ────event────> Advisor D
```

**Use cases**: Status updates, announcements, system-wide notifications

### 4.3 Private Message

```
Advisor A ────advisor.message──> Advisor B
```

**Delivery**: Runtime routes based on `to` field  
**Privacy**: Only recipient and sender can see message content

### 4.4 Group Session

```
Runtime ────group.session.message──> Advisor A
         ────group.session.message──> Advisor B
         ────group.session.message──> Advisor C
```

**Delivery**: Runtime routes to all session participants  
**Context**: Shared context object included

## 5. Event Processing

### 5.1 Publication

```typescript
class EventBus implements IEventBus {
  publish<TPayload>(event: Event<TPayload>): void {
    const handlers = this.getHandlers(event.type);
    for (const handler of handlers) {
      handler(event);
    }
  }
}
```

**Properties**:
- Synchronous delivery
- Order preserved
- All handlers invoked even if one throws
- No retry on failure

### 5.2 Subscription

```typescript
interface EventSubscription {
  eventType: string;
  handler: EventHandler;
  priority: number;                // Higher = called first
  filter?: (event: Event) => boolean;
  once?: boolean;                  // Unsubscribe after first call
}
```

**Properties**:
- Handlers invoked in priority order
- Filters allow selective processing
- `once` subscriptions auto-unsubscribe
- Subscriptions are scoped to Runtime instance

### 5.3 Priority

Events have priority:
- **Low**: Background tasks, logging
- **Normal**: Standard operations
- **High**: User-facing operations
- **Critical**: Security, errors

Higher-priority handlers are invoked first.

## 6. Event Replay and Audit

### 6.1 Replay Buffer

The Runtime maintains a bounded replay buffer:

```typescript
interface ReplayBuffer {
  maxEvents: number;               // Max events to retain
  maxAgeMs: number;                // Max age of events
  append(event: Event): void;
  replay(fromTimestamp: number): Event[];
  clear(): void;
}
```

### 6.2 Audit Trail

All events are persisted to audit log:
- Immutable event store
- Append-only
- Timestamped
- Source-attributed

## 7. Dead Letter Handling

Events that cannot be processed are sent to a dead letter queue:

```typescript
interface DeadLetterQueue {
  enqueue(event: Event, error: Error): void;
  reprocess(eventId: string): boolean;
  list(): readonly DeadLetterEntry[];
  clear(eventId: string): void;
}
```

**Reasons for dead letter**:
- Handler threw exception
- Handler not found
- Event schema validation failed
- Processing timeout

## 8. Event Cancellation

Events can be cancelled before processing:

```typescript
interface CancellationToken {
  cancel(): void;
  isCancelled: boolean;
}
```

**Use cases**:
- User cancelled request
- Session ended before event processed
- Timeout exceeded

## 9. Event Schema Versioning

Events are versioned to support backward compatibility:

```typescript
interface EventSchema {
  version: string;
  type: string;
  payloadSchema: JSONSchema;
  deprecated: boolean;
  deprecatedAt?: number;
}
```

**Migration strategy**:
- Old events are readable
- New events may have new fields
- Deprecated events are phased out gracefully

## 10. Event Security

- **Event validation**: All events validated against schema
- **Source verification**: Event source is authenticated
- **Payload encryption**: Sensitive payloads are encrypted
- **Access control**: Subscribers filtered by capability
- **Audit logging**: All events logged to security audit

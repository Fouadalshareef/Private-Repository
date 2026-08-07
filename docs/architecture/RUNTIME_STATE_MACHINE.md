# Runtime State Machine

## 1. Runtime Lifecycle

```
                ┌─────────────┐
                │  Booting     │
                └──────┬───────┘
                       │
                       ▼
                ┌─────────────┐
                │ Initializing │
                └──────┬───────┘
                       │
           ┌───────────┴───────────┐
           │                       │
           ▼                       ▼
    ┌─────────────┐         ┌─────────────┐
    │   Failed     │         │    Ready     │
    └─────────────┘         └──────┬──────┘
                                   │
                   ┌───────────────┼───────────────┐
                   │               │               │
                   ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │ Processing   │ │ Idle/Wait   │ │ Degraded    │
            └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
                   │               │               │
                   └───────────────┼───────────────┘
                                   │
                                   ▼
                            ┌─────────────┐
                            │ Shutting Down│
                            └─────────────┘
```

## 2. State Descriptions

### 2.1 Booting

- Runtime process starting
- Core services initializing
- No event processing yet

**Allowed transitions**: Initializing, Failed

### 2.2 Initializing

- Core services created
- Subsystems initializing
- No advisor processing yet

**Allowed transitions**: Ready, Failed

### 2.3 Ready

- All subsystems initialized
- Ready to accept requests
- Idle state

**Allowed transitions**: Processing, Idle/Wait, Shutting Down

### 2.4 Processing

- Actively processing advisor tasks
- Tool executions in progress
- Events being processed

**Allowed transitions**: Ready, Idle/Wait, Degraded, Shutting Down

### 2.5 Idle/Wait

- No active tasks
- Waiting for input
- Low resource usage

**Allowed transitions**: Ready, Processing, Shutting Down

### 2.6 Degraded

- Partial functionality available
- Some subsystems failed
- Error recovery in progress

**Allowed transitions**: Ready, Processing, Shutting Down

### 2.7 Shutting Down

- Graceful shutdown initiated
- Advisors being stopped
- Resources being freed

**Allowed transitions**: Stopped

### 2.8 Stopped

- All subsystems stopped
- All resources freed
- Process exiting

**Allowed transitions**: None (terminal state)

### 2.9 Failed

- Initialization failed
- Unrecoverable error
- Process exiting

**Allowed transitions**: None (terminal state)

## 3. Advisor State Machine

```
                ┌─────────────┐
                │   Created    │
                └──────┬───────┘
                       │
                       ▼
                ┌─────────────┐
                │ Initialized  │
                └──────┬───────┘
                       │
                       ▼
                ┌─────────────┐
                │   Activated   │
                └──────┬───────┘
                       │
           ┌───────────┼───────────┐
           │           │           │
           ▼           ▼           ▼
    ┌─────────────┐ ┌───────┐ ┌─────────────┐
    │    Busy      │ │Waiting│ │  Suspended   │
    └──────┬──────┘ └───┬───┘ └──────┬──────┘
           │            │            │
           │            │            │
           ▼            ▼            ▼
    ┌─────────────┐ ┌───────┐ ┌─────────────┐
    │  Completed   │ │Resumed│ │   Resumed    │
    └──────┬──────┘ └───┬───┘ └──────┬──────┘
           │            │            │
           └────────────┼────────────┘
                        │
                        ▼
                 ┌─────────────┐
                 │    Stopped    │
                 └──────┬───────┘
                        │
                        ▼
                 ┌─────────────┐
                 │   Disposed    │
                 └─────────────┘
```

## 4. Advisor State Descriptions

### 4.1 Created

- Advisor instance created
- Identity assigned
- Not yet initialized

**Allowed**: Initialized

### 4.2 Initialized

- Prompt loaded
- Memory allocated
- Subscriptions registered
- Ready to activate

**Allowed**: Activated, Disposed

### 4.3 Activated

- Advisor ready to receive messages
- Event subscriptions active
- Memory accessible

**Allowed**: Busy, Waiting, Suspended, Stopped, Disposed

### 4.4 Busy

- Executing a task
- Processing user input
- Tool calls in progress

**Allowed**: Activated, Waiting, Stopped

### 4.5 Waiting

- Waiting for external input
- Waiting for tool result
- Waiting for human approval

**Allowed**: Activated, Busy, Suspended

### 4.6 Suspended

- Temporarily inactive
- State preserved
- Resources partially freed

**Allowed**: Activated (resumed), Stopped, Disposed

### 4.7 Stopped

- Gracefully stopped
- State can be persisted
- Resources freed except memory

**Allowed**: Activated (resumed), Disposed

### 4.8 Disposed

- Permanently removed
- All resources freed
- Cannot be reactivated

**Allowed**: None (terminal state)

## 5. Collaboration Session State Machine

```
                ┌─────────────┐
                │   Created    │
                └──────┬───────┘
                       │
                       ▼
                ┌─────────────┐
                │   Active     │
                └──────┬───────┘
                       │
           ┌───────────┼───────────┐
           │           │           │
           ▼           ▼           ▼
    ┌─────────────┐ ┌───────┐ ┌─────────────┐
    │   Paused     │ │Ended  │ │  Timeout    │
    └──────┬──────┘ └───┬───┘ └──────┬──────┘
           │            │            │
           │            │            │
           ▼            ▼            ▼
    ┌─────────────┐ ┌───────┐ ┌─────────────┐
    │   Resumed    │ │Archived│ │  Archived   │
    └─────────────┘ └───────┘ └─────────────┘
```

## 6. Event Correlations

Events are correlated across the system:

```
Runtime Start
  └── advisor.created (×N)
      └── advisor.activated (×N)
          └── session.created
              └── advisor.task.started
                  └── tool.executed (×N)
                      └── advisor.task.completed
                          └── session.ended
                              └── advisor.suspended
```

Correlation IDs link related events across advisors and subsystems.

## 7. State Persistence

### 7.1 Persisted States

| State | Persisted? | Storage |
|-------|-----------|---------|
| Advisor Initialized | Yes | Advisor registry |
| Advisor Activated | No | Runtime memory |
| Advisor Busy | No | Runtime memory |
| Advisor Waiting | No | Runtime memory |
| Advisor Suspended | Yes | Advisor state store |
| Advisor Stopped | Yes | Advisor state store |
| Session Created | Yes | Session store |
| Session Active | No | Runtime memory |
| Session Ended | Yes | Session archive |

### 7.2 Recovery

On Runtime restart:
1. Load persisted advisor states
2. Restore suspended advisors to Suspended state
3. Load active sessions from archive
4. Resume or restart as configured

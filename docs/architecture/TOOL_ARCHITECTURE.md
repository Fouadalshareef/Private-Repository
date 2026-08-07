# Tool Architecture

## 1. Vision

Tools in Cupaw are **first-class capabilities** that advisors use to interact with the world. The Tool Architecture ensures:

- **Safety**: Tools are sandboxed and permission-checked
- **Observability**: All tool executions are logged and auditable
- **Reliability**: Timeouts, retries, and error handling are standardized
- **Extensibility**: New tools can be added without modifying runtime
- **Isolation**: Tool failures do not affect advisors or runtime

## 2. Tool Model

### 2.1 Tool Definition

```typescript
interface ITool {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly parameters: JSONSchema;
  readonly returnType: JSONSchema;
  readonly capabilities: readonly ToolCapability[];
  readonly sensitivity: ToolSensitivity;
  readonly timeoutMs?: number;
  readonly retryPolicy?: RetryPolicy;
}

type ToolCapability = 'read' | 'write' | 'execute' | 'network' | 'system';
```

### 2.2 Tool Metadata

Every tool declares its metadata:

| Metadata | Description | Example |
|----------|-------------|---------|
| `name` | Unique tool identifier | `read_file` |
| `description` | Human-readable description | "Read a file from workspace" |
| `version` | Semantic version | `1.0.0` |
| `parameters` | JSON Schema for arguments | `{ path: string }` |
| `returnType` | JSON Schema for return value | `{ content: string }` |
| `capabilities` | What the tool can do | `['read']` |
| `sensitivity` | Risk level | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `timeoutMs` | Max execution time | `30000` |
| `retryPolicy` | Retry configuration | `{ maxAttempts: 3, backoff: 'exponential' }` |

## 3. Tool Registry

### 3.1 Registry Design

```
ToolRegistry
├── Tool Index (by name)
├── Tool Index (by capability)
├── Tool Index (by sensitivity)
└── Tool Version Store
```

### 3.2 Registry Operations

```typescript
interface IToolRegistry {
  register(tool: ITool): void;
  unregister(name: string): boolean;
  get(name: string): ITool | undefined;
  getAll(): readonly ITool[];
  findByCapability(capability: ToolCapability): readonly ITool[];
  findBySensitivity(sensitivity: ToolSensitivity): readonly ITool[];
  validateArgs(name: string, args: Record<string, unknown>): ToolValidationResult;
}
```

### 3.3 Tool Discovery

Advisors discover tools via the registry:

1. **Direct lookup**: `registry.get('read_file')`
2. **Capability search**: `registry.findByCapability('read')`
3. **Permission-filtered**: Registry filters by advisor's permissions
4. **Auto-discovery**: Plugins can register tools at runtime

## 4. Tool Permissions

### 4.1 Capability-Based Permissions

Tools are granted to advisors based on capabilities:

```typescript
interface ToolPermission {
  advisorId: AdvisorId;
  toolName: string;
  capabilities: readonly ToolCapability[];
  grantedAt: number;
  grantedBy: string;
  expiresAt?: number;
}
```

### 4.2 Permission Model

| Permission Level | Description |
|------------------|-------------|
| **None** | Tool cannot be used |
| **Read** | Can read data |
| **Write** | Can modify data |
| **Execute** | Can execute code |
| **Network** | Can access network |
| **System** | Can modify system state |

### 4.3 Permission Enforcement

```
Advisor requests tool execution
        │
        ▼
Runtime checks advisor permissions
        │
        ├─── Allowed ──> Proceed to execution
        │
        └─── Denied ──> Return error, log denial
```

## 5. Tool Execution

### 5.1 Execution Flow

```
Request
  │
  ▼
Validate (schema, permissions)
  │
  ▼
Authorize (policy check)
  │
  ▼
Prepare (context, timeout)
  │
  ▼
Execute (in sandbox)
  │
  ▼
Validate Result (schema, safety)
  │
  ▼
Log (audit trail)
  │
  ▼
Return Result
```

### 5.2 Timeout Enforcement

```typescript
interface ToolTimeoutConfig {
  defaultTimeoutMs: number;
  maxTimeoutMs: number;
  perToolTimeoutMs: Readonly<Record<string, number>>;
}
```

**Rules**:
- Tool-specific timeout overrides default
- Max timeout prevents abuse
- Timeout throws `ToolTimeoutError`
- Timeout is logged and audited

### 5.3 Retry Policy

```typescript
interface RetryPolicy {
  maxAttempts: number;
  backoff: 'linear' | 'exponential';
  initialDelayMs: number;
  maxDelayMs: number;
  retryableErrors: readonly string[];
}
```

**Rules**:
- Only retry on `retryableErrors`
- Backoff applied between retries
- Max attempts enforced
- All retries logged

## 6. Tool Isolation

### 6.1 Sandbox Model

Tools execute in isolated environments:

```
┌─────────────────────────────────────────────┐
│                 Tool Sandbox                 │
│  ┌─────────────────────────────────────────┐ │
│  │  Tool Handler                          │ │
│  │  - Limited filesystem access           │ │
│  │  - No network access (unless granted)  │ │
│  │  - No system calls (unless granted)    │ │
│  │  - Memory limits                       │ │
│  │  - CPU time limits                     │ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │  Result Validator                      │ │
│  │  - Schema validation                   │ │
│  │  - Size limits                         │ │
│  │  - Security scanning                   │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 6.2 Isolation Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| **None** | No isolation | Internal trusted tools |
| **Basic** | Schema validation, timeout | Standard tools |
| **Sandbox** | Filesystem/network isolation | User-facing tools |
| **Strict** | Full sandbox + resource limits | Untrusted tools |

## 7. Tool Context

Tools receive context about their execution:

```typescript
interface ToolExecutionContext {
  toolCallId: string;
  advisorId: AdvisorId;
  sessionId: string;
  timestamp: number;
  timeoutMs: number;
  sandboxLevel: IsolationLevel;
  allowedPaths?: readonly string[];
  allowedHosts?: readonly string[];
  environment: Readonly<Record<string, string>>;
}
```

## 8. Tool Audit

All tool executions are audited:

```typescript
interface ToolAuditEntry {
  toolCallId: string;
  toolName: string;
  advisorId: AdvisorId;
  sessionId: string;
  timestamp: number;
  args: Record<string, unknown>;
  result: ToolResult;
  durationMs: number;
  success: boolean;
  error?: string;
  sandboxLevel: IsolationLevel;
}
```

Audit entries are:
- Immutable once created
- Append-only
- Timestamped
- Source-attributed
- Retained for compliance period

## 9. Tool Versioning

Tools can have multiple versions:

```typescript
interface ToolVersion {
  name: string;
  version: string;
  definition: ITool;
  deprecated: boolean;
  deprecatedAt?: number;
  migrationGuide?: string;
}
```

**Versioning rules**:
- Multiple versions can coexist
- Advisors specify preferred version
- Deprecated versions emit warnings
- Migration is advisor's responsibility

## 10. Tool Security

### 10.1 Security Checks

Every tool execution undergoes:

1. **Registration check**: Tool must be registered
2. **Permission check**: Advisor must have permission
3. **Schema validation**: Arguments must match schema
4. **Safety check**: Result must be safe
5. **Rate limit check**: Advisor must not exceed rate limits

### 10.2 Sensitive Tools

Tools with `sensitivity: CRITICAL` require:
- Human approval before execution
- Dual authorization
- Full audit trail
- Extended timeout for review

## 11. Tool Registry Lifecycle

```
Registration
    │
    ▼
Validation (schema, name uniqueness)
    │
    ▼
Indexing (by name, capability, sensitivity)
    │
    ▼
Available for execution
    │
    ▼
Unregistration (on demand or deprecation)
    │
    ▼
Removed from index
```

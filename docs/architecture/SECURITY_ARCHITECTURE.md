# Security Architecture

## 1. Vision

Security in Cupaw is **capability-based, defense-in-depth, and audit-first**. Every operation is validated, every action is logged, and every entity operates within explicit boundaries.

## 2. Security Principles

1. **Zero Trust**: No implicit trust between components
2. **Least Privilege**: Advisors get minimum capabilities needed
3. **Explicit Authorization**: Every tool call requires authorization
4. **Immutable Audit**: All security events are immutable
5. **Isolation**: Advisors, sessions, and tools are isolated
6. **Fail Secure**: Errors default to deny, not allow

## 3. Security Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    Cupaw Runtime                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │               Security Boundary                         ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    ││
│  │  │  Session    │  │  Advisor    │  │   Tool      │    ││
│  │  │  Security   │  │  Permissions│  │ Permissions │    ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘    ││
│  │                          │                             ││
│  │  ┌───────────────────────────────────────────────┐    ││
│  │  │           Authorization Engine                │    ││
│  │  └───────────────────────────────────────────────┘    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## 4. Session Security

### 4.1 Session Model

```typescript
interface SessionSecurity {
  sessionId: string;
  status: SessionStatus;           // Active, Suspended, Expired, Terminated
  createdAt: number;
  lastAccessedAt: number;
  expiresAt?: number;
  metadata: Readonly<Record<string, unknown>>;
  auditTrail: readonly SessionAuditEntry[];
}
```

### 4.2 Session Lifecycle Security

| Phase | Security Checks |
|-------|-----------------|
| **Creation** | Validate session ID uniqueness, set TTL |
| **Activation** | Verify session not expired, check permissions |
| **Access** | Validate session status, log access |
| **Expiration** | Mark expired, notify owner, archive |
| **Termination** | Revoke permissions, clear sensitive data |

### 4.3 Session Isolation

- Sessions cannot access other sessions' memory
- Sessions cannot modify other sessions' state
- Session IDs are unforgeable (cryptographic random)
- Session tokens are validated on every access

## 5. Advisor Permissions

### 5.1 Permission Model

```typescript
interface AdvisorPermissions {
  advisorId: AdvisorId;
  capabilities: readonly Capability[];
  toolPermissions: readonly ToolPermission[];
  contextPermissions: readonly ContextPermission[];
  delegationPermissions: readonly DelegationPermission[];
  expiresAt?: number;
}
```

### 5.2 Capability Types

| Capability | Description |
|------------|-------------|
| `read` | Can read files, memory, context |
| `write` | Can write files, modify memory |
| `execute` | Can execute tools and code |
| `network` | Can access external resources |
| `system` | Can modify system state |
| `delegate` | Can delegate tasks to other advisors |
| `admin` | Can manage other advisors (restricted) |

### 5.3 Permission Enforcement

```
Advisor requests action
        │
        ▼
Runtime checks advisor permissions
        │
        ├─── Has capability ──> Check tool-specific permission
        │                           │
        │                           ├─── Allowed ──> Execute
        │                           │
        │                           └─── Denied ──> Return error
        │
        └─── Missing capability ──> Return error
```

## 6. Tool Permissions

### 6.1 Permission Matrix

```typescript
interface ToolPermissionMatrix {
  [advisorId: string]: {
    [toolName: string]: ToolPermission;
  };
}
```

### 6.2 Permission Levels

| Level | Description |
|-------|-------------|
| **None** | Cannot use tool |
| **Read** | Can read tool output |
| **Use** | Can execute tool |
| **Admin** | Can modify tool configuration |

### 6.3 Dynamic Permissions

Permissions can be dynamically adjusted:
- Time-based: Permissions expire
- Context-based: Permissions change based on session
- Approval-based: Permissions granted after human approval
- Revocable: Permissions can be revoked at any time

## 7. Runtime Permissions

### 7.1 Runtime Permission Model

The Runtime itself has permissions:

```typescript
interface RuntimePermissions {
  canCreateAdvisors: boolean;
  canTerminateAdvisors: boolean;
  canModifySystemPrompts: boolean;
  canAccessAllSessions: boolean;
  canManageTools: boolean;
  canModifySecurityPolicy: boolean;
}
```

### 7.2 Permission Scopes

| Scope | Description |
|-------|-------------|
| **Local** | Current Runtime instance |
| **Session** | Specific session |
| **Advisor** | Specific advisor |
| **Global** | Entire Runtime |

## 8. Context Isolation

### 8.1 Isolation Rules

1. **Session isolation**: Sessions cannot see other sessions' context
2. **Advisor isolation**: Advisors cannot see other advisors' working context
3. **Explicit sharing**: Context must be explicitly shared
4. **Versioning**: Shared context is versioned
5. **TTL**: Context entries have time-to-live

### 8.2 Context Flow Control

```
User Input
    │
    ▼
Session Context (isolated)
    │
    ├─── Advisor A ──> Working Context (isolated)
    │
    ├─── Advisor B ──> Working Context (isolated)
    │
    └─── Shared Context (explicitly granted)
```

## 9. Secret Management

### 9.1 Secret Storage

Secrets are never stored in plain text:

```typescript
interface SecretManager {
  store(secret: Secret): Promise<string>;
  retrieve(secretId: string): Promise<Secret | undefined>;
  revoke(secretId: string): Promise<boolean>;
  rotate(secretId: string): Promise<string>;
}

interface Secret {
  id: string;
  type: 'api_key' | 'password' | 'certificate' | 'token';
  encryptedValue: string;
  keyVersion: number;
  createdAt: number;
  expiresAt?: number;
}
```

### 9.2 Secret Access

- Secrets are decrypted only at use time
- Decryption happens in secure enclave (future)
- Access to secrets is logged
- Secrets are never passed to LLM providers
- Secrets are never logged

## 10. Audit Logs

### 10.1 Audit Model

```typescript
interface AuditEntry {
  id: string;
  timestamp: number;
  actor: Actor;                    // Who performed action
  action: string;                  // What was done
  target: string;                  // What was acted upon
  result: 'success' | 'failure' | 'denied';
  reason?: string;
  metadata: Readonly<Record<string, string>>;
  immutable: true;                 // Cannot be modified
}
```

### 10.2 Audit Events

| Event | Actor | Action | Target |
|-------|-------|--------|--------|
| Session created | User/Runtime | create | Session |
| Advisor activated | Runtime | activate | Advisor |
| Tool executed | Advisor | execute | Tool |
| Permission granted | Admin/Runtime | grant | Advisor/Tool |
| Permission revoked | Admin/Runtime | revoke | Advisor/Tool |
| Secret accessed | Advisor | access | Secret |

### 10.3 Audit Storage

- Append-only log
- Immutable entries
- Tamper-evident (future: blockchain-style hashing)
- Retained for compliance period
- Exportable for external audit

## 11. Security State Machine

```
                    ┌─────────────┐
                    │   Unlocked  │
                    └──────┬──────┘
                           │
                    Lockdown triggered
                           │
                           ▼
                    ┌─────────────┐
                    │   Lockdown  │
                    │   (Read-only)│
                    └──────┬──────┘
                           │
                    Unlock authorized
                           │
                           ▼
                    ┌─────────────┐
                    │   Unlocked  │
                    └─────────────┘
```

### 11.1 Lockdown Mode

When security incident detected:
1. All writes are blocked
2. All tool executions are blocked
3. Advisor communications are logged but not blocked
4. Alerts are generated
5. Human operator notified

## 12. Threat Model

### 12.1 Identified Threats

| Threat | Mitigation |
|--------|-----------|
| Prompt injection | Input sanitization, layer isolation |
| Tool misuse | Capability-based permissions |
| Data exfiltration | Network isolation, audit logging |
| Privilege escalation | Least privilege, capability checks |
| Session hijacking | Secure session IDs, expiration |
| Audit tampering | Immutable logs, append-only |
| Denial of service | Timeouts, rate limits, resource quotas |

### 12.2 Security Boundaries

```
Trusted:
  - Runtime internals
  - System prompts
  - Security policies

Untrusted:
  - User input
  - LLM responses
  - Tool outputs
  - External data
```

All untrusted data is validated and sanitized before use.

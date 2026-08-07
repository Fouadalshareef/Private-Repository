# Prompt Architecture

## 1. Layered Prompt Model

Cupaw uses a **layered prompt architecture** where each layer adds specific context and constraints. The final prompt sent to the LLM is the composition of all applicable layers.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 7: User Prompt                                       │
│  "Implement a login feature"                                │
├─────────────────────────────────────────────────────────────┤
│  Layer 6: Safety Prompt                                     │
│  "Never expose secrets. Always validate input."             │
├─────────────────────────────────────────────────────────────┤
│  Layer 5: Memory Prompt                                     │
│  "Previous attempts: ... Current context: ..."             │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Project Prompt                                    │
│  "Project: Cupaw. Stack: TypeScript. Standards: ..."       │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Task Prompt                                       │
│  "Task: Design REST API for login. Constraints: ..."       │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Advisor Prompt                                    │
│  "You are a Backend Engineer. Responsibilities: ..."       │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Runtime Prompt                                    │
│  "You are operating in Cupaw Runtime. Rules: ..."          │
├─────────────────────────────────────────────────────────────┤
│  Layer 0: System Prompt                                     │
│  "You are a helpful AI assistant."                          │
└─────────────────────────────────────────────────────────────┘
```

## 2. Layer Definitions

### 2.0 System Prompt (Base Layer)

**Purpose**: Establishes the fundamental AI behavior  
**Source**: LLM Provider  
**Content**: Base system instructions (e.g., "You are a helpful assistant")  
**Mutability**: Fixed per provider  
**Size**: Small (50-200 tokens)

### 2.1 Runtime Prompt

**Purpose**: Informs the LLM about operating within Cupaw Runtime  
**Source**: Runtime  
**Content**:
- Operating environment rules
- Communication protocols
- Safety constraints
- Error handling expectations

**Mutability**: Fixed per runtime version  
**Size**: Small (100-300 tokens)

### 2.2 Advisor Prompt

**Purpose**: Defines the advisor's identity, role, and behavior  
**Source**: Advisor definition (versioned)  
**Content**:
- Advisor role and specialty
- Responsibilities
- Decision boundaries
- Writing style
- Engineering focus

**Mutability**: Versioned, immutable per version  
**Size**: Medium (200-500 tokens)

### 2.3 Task Prompt

**Purpose**: Provides task-specific instructions and constraints  
**Source**: Runtime/Planner  
**Content**:
- Current task description
- Acceptance criteria
- Constraints and requirements
- Expected output format

**Mutability**: Dynamic per task  
**Size**: Medium (100-400 tokens)

### 2.4 Project Prompt

**Purpose**: Provides project-specific context  
**Source**: Project configuration  
**Content**:
- Project name and description
- Technology stack
- Coding standards
- Architecture decisions
- Team conventions

**Mutability**: Changes with project configuration  
**Size**: Medium (200-600 tokens)

### 2.5 Memory Prompt

**Purpose**: Provides relevant memory/history context  
**Source**: Memory subsystem  
**Content**:
- Recent conversation history
- Relevant past decisions
- User preferences
- Previous tool results

**Mutability**: Dynamic per conversation  
**Size**: Variable (can be large, subject to truncation)

### 2.6 Safety Prompt

**Purpose**: Enforces safety and security constraints  
**Source**: Security subsystem  
**Content**:
- Prohibited actions
- Secret handling rules
- Validation requirements
- Audit requirements

**Mutability**: Fixed per security policy  
**Size**: Small (50-200 tokens)

### 2.7 User Prompt

**Purpose**: The actual user request  
**Source**: User input  
**Content**: Raw user message  
**Mutability**: Immutable once created  
**Size**: Variable

## 3. Prompt Composition

The PromptEngine composes all layers into a single message array:

```typescript
interface PromptCompositionResult {
  messages: AIMessage[];
  tokenBreakdown: {
    system: number;
    runtime: number;
    advisor: number;
    task: number;
    project: number;
    memory: number;
    safety: number;
    user: number;
    total: number;
  };
  truncated: boolean;
  truncatedLayers: readonly string[];
}
```

### 3.1 Composition Rules

1. **System prompt always first**
2. **Runtime prompt always second**
3. **Advisor prompt always third**
4. **Task prompt before project prompt**
5. **Project prompt before memory prompt**
6. **Memory prompt before user prompt**
7. **Safety prompt always last before user prompt**
8. **Layers are optional**: Missing layers are skipped
9. **Truncation**: If total tokens exceed limit, truncate from memory layer first, then project, then task

## 4. Prompt Template System

### 4.1 Template Format

Templates use `{{variable}}` syntax:

```
You are {{advisorName}}, a {{advisorSpecialty}}.
Your responsibilities include:
{{responsibilities}}
```

### 4.2 Variable Scoping

Variables are scoped to their layer:

```typescript
interface PromptVariables {
  // Runtime layer
  runtimeVersion: string;
  runtimeMode: 'cli' | 'api' | 'gui';

  // Advisor layer
  advisorName: string;
  advisorSpecialty: string;
  advisorRole: string;

  // Task layer
  taskDescription: string;
  taskConstraints: string[];

  // Project layer
  projectName: string;
  projectStack: string[];

  // Memory layer
  conversationHistory: string;
  relevantMemories: string[];

  // User layer
  userInput: string;
}
```

### 4.3 Variable Resolution

1. Variables are resolved layer by layer
2. Undefined variables in strict mode throw `MissingPromptVariableError`
3. In non-strict mode, undefined variables are left as `{{variable}}`
4. Variable values are sanitized before insertion (no injection)

## 5. Prompt Validation

All prompts undergo validation:

1. **Structure validation**: All required layers present
2. **Token budget validation**: Total tokens within limits
3. **Variable validation**: All variables defined (strict mode)
4. **Security validation**: No injection patterns detected
5. **Consistency validation**: No contradictory instructions

## 6. Prompt Versioning

Prompts are versioned:

```typescript
interface PromptVersion {
  version: string;
  advisorId: AdvisorId;
  systemPrompt: string;
  runtimePrompt: string;
  safetyPrompt: string;
  createdAt: number;
  deprecatedAt?: number;
}
```

Versioning allows:
- Rollback to previous prompt versions
- A/B testing of prompts
- Audit of prompt changes
- Gradual migration between versions

## 7. Prompt Injection Prevention

The Runtime enforces these rules:

1. **No user input in system/runtime/advisor layers**: User input only appears in user prompt layer
2. **Variable sanitization**: All variables are escaped before insertion
3. **Layer isolation**: Lower layers cannot be influenced by higher layers
4. **Read-only templates**: Templates are immutable after registration
5. **Audit trail**: All prompt compositions are logged

## 8. Prompt Caching

To reduce token usage and improve performance:

1. **Static layers cached**: System, runtime, advisor, safety prompts are cached
2. **Dynamic layers computed**: Task, project, memory, user layers computed per request
3. **Cache invalidation**: Cached prompts invalidated on version change
4. **Token counting**: Token count cached with prompt hash

## 9. Prompt Observability

All prompt operations are observable:

1. **Composition events**: Every prompt composition emits an event
2. **Token usage**: Token count per layer is tracked
3. **Truncation events**: Truncation is logged with reasons
4. **Validation failures**: Failed validations emit error events
5. **Audit trail**: Full prompt composition is auditable

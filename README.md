# Cupaw AI Platform Core

This is the core foundation repository for the Cupaw AI Platform.

## Requirements

- Node.js 22+
- npm (or pnpm/yarn)

## Folder Structure

- `src/core/` - Dependency injection container and service descriptors
- `src/events/` - Event bus for lifecycle events
- `src/config/` - Configuration management
- `src/logging/` - Structured logging system
- `src/types/` - Shared type definitions
- `src/utils/` - Utility functions
- `src/ai/` - AI provider integration and message types
- `src/prompt/` - Prompt engineering and template management
- `src/context/` - Conversation memory and context window management
- `src/agent/` - Agent executor with ReAct tool-call loop
- `src/tools/` - Tool registry, execution engine, and built-in tools
- `src/security/` - Session management and tool authorization
- `src/workspace/` - Workspace management
- `src/filesystem/` - Virtual file system
- `src/project/` - Project scanning and modeling
- `src/model/` - Source index and model management
- `src/language/` - Language services and AST parsing
- `src/plugins/` - Plugin system foundation
- `src/bootstrap/` - Application bootstrap and wiring
- `src/cli/` - Interactive CLI/REPL entry point
- `src/advisors/` - Advisor persona system, routing, execution pipeline, and security scoping
- `tests/` - Comprehensive test suite
- `docs/` - Documentation

## Scripts

- `npm run dev`: Run TypeScript in watch mode.
- `npm run build`: Compile the TypeScript code to JavaScript.
- `npm run test`: Run Vitest test suite.
- `npm run lint`: Run ESLint.
- `npm run format`: Format code using Prettier.
- `npm run check`: Run formatter, linter, builder, and tests in sequence.

## Getting Started

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Start the CLI

```bash
npx tsx src/bin/cupaw.ts
```

## CLI Commands

The Cupaw AI Platform provides an interactive REPL (Read-Eval-Print Loop) for chatting with the AI agent and managing advisor sessions.

### General Commands

- `/help` - Show available commands
- `/clear` - Clear the current conversation session
- `/session` - Show current session information
- `/tools` - List all registered tools
- `/exit` or `/quit` - Exit the CLI

### Advisor Commands

The platform includes 11 built-in advisor personas, each with specialized roles and tool permissions.

- `/advisors` - List all available advisors with their id, name, specialty, and role
- `/route <query>` - Route a query to the best matching advisor (shows confidence score and matched keywords)
- `/switch <advisorId>` - Switch to a specific advisor for the current session

#### Available Advisors

| Advisor ID | Name | Specialty | Allowed Tools |
|------------|------|-----------|---------------|
| `chief-ai-architect` | Chief AI Architect | AI system architecture and platform design | read_file, list_directory, search_workspace |
| `software-engineer` | Software Engineer | Full-stack software development and implementation | read_file, write_file, list_directory, search_workspace, execute_command |
| `frontend-engineer` | Frontend Engineer | Web frontend development and browser performance | read_file, write_file, list_directory, search_workspace |
| `backend-engineer` | Backend Engineer | Server-side development and API design | read_file, write_file, list_directory, search_workspace, execute_command |
| `ui-designer` | UI Designer | Visual interface design and design systems | read_file, list_directory, search_workspace |
| `ux-designer` | UX Designer | User experience design and usability engineering | read_file, list_directory, search_workspace |
| `devops-engineer` | DevOps Engineer | CI/CD, infrastructure, and reliability engineering | read_file, write_file, list_directory, search_workspace, execute_command |
| `security-advisor` | Security Advisor | Application security and secure coding practices | read_file, list_directory, search_workspace |
| `database-architect` | Database Architect | Data modeling and database performance | read_file, list_directory, search_workspace |
| `qa-engineer` | QA Engineer | Test strategy and quality assurance | read_file, list_directory, search_workspace, execute_command |
| `documentation-writer` | Documentation Writer | Technical writing and documentation | read_file, write_file, list_directory, search_workspace |

### Usage Examples

```text
cupaw> /advisors
Available Advisors (11):
  [chief-ai-architect] Chief AI Architect
    Specialty: AI system architecture and platform design
    Role: chief_ai_architect
  ...

cupaw> /route How do I deploy to Kubernetes?
Routing query: "How do I deploy to Kubernetes?"
Matched by: keyword
Confidence: 85%
Selected advisor: DevOps Engineer (devops-engineer)
Specialty: CI/CD, infrastructure, and reliability engineering
Matched keywords: deploy, kubernetes, pipeline

cupaw> /switch devops-engineer
Switched to advisor: DevOps Engineer (CI/CD, infrastructure, and reliability engineering)

cupaw> How do I set up a CI/CD pipeline?
[AI response based on DevOps Engineer context]

cupaw> /tools
Registered tools (6):
  - fs.read_file: Read file contents
  - fs.write_file: Write content to a file
  - fs.delete_file: Delete a file
  - fs.list_directory: List directory contents
  - workspace.search: Search workspace for patterns
  - terminal.execute: Execute terminal commands

cupaw> /session
Session ID: cli-session
Conversation messages: 4
Security status: active
Created at: 2026-08-06T...
Active advisor: devops-engineer
Pending approvals: 0

cupaw> /exit
Goodbye!
```

## Architecture

### Core Modules

- **Bootstrap**: Initializes core foundation services (DI container, configuration, logger, event bus)
- **CLI**: Interactive REPL shell with advisor command handling and automatic routing
- **Agent**: Agent executor with ReAct tool-call loop, streaming, and lifecycle events
- **Tools**: Tool registry, execution engine with timeout enforcement, and built-in filesystem/workspace/terminal tools
- **Security**: Session management and tool authorization engine with pending approvals
- **Context**: Conversation memory with sliding-window context window strategy
- **Prompt**: Prompt engine with template management and variable substitution
- **AI**: AI provider abstraction with mock provider for testing
- **Workspace**: Workspace management for project context
- **FileSystem**: Virtual file system for safe file operations
- **Advisors**: Advisor persona system with 11 predefined roles, context router, execution pipeline, and dynamic tool access control

### Advisor System

The advisor system provides:

1. **Advisor Personas**: 11 predefined advisor roles, each with specialized capabilities and tool permissions
2. **Context Router**: Deterministic rule-based routing that matches user queries to the most suitable advisor based on keywords, metadata, and custom rules
3. **Execution Pipeline**: Isolated advisor session management with conversation memory integration and tool execution
4. **Security Scoping**: Dynamic tool access control that restricts each advisor to their allowed tools via `AdvisorSecurityPolicy`

### Security Model

- Each advisor has an `allowedTools` array defined in the `AdvisorCatalog`
- `AdvisorSecurityPolicy` evaluates `allowedTools` against the registered `ToolRegistry`
- Supports direct name matching and wildcard patterns (`*` and `?`)
- All security decisions and scopes are immutable (`Object.freeze`)
- Unmatched patterns generate warnings for debugging
- The `AdvisorExecutionPipeline` enforces security scoping at session creation time

### Immutability Guarantees

All public API outputs are deeply frozen with `Object.freeze`:
- Advisor security decisions (`ToolAccessDecision`)
- Advisor tool scopes (`AdvisorToolScope`)
- Advisor execution results (`AdvisorStepResult`, `AdvisorPipelineResult`)
- CLI outputs (`AdvisorsListOutput`, `RouteQueryOutput`, `SwitchAdvisorOutput`)
- Conversation memory sessions and message arrays

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Building

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

## License

MIT

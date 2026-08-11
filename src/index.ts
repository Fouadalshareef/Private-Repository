/**
 * Cupaw AI Platform Core Foundation
 */
export const VERSION = '1.0.0';

export * from './bootstrap/index.js';
export * from './plugins/index.js';
export * from './workspace/index.js';
export * from './filesystem/index.js';
export * from './project/index.js';
export * from './model/index.js';
export * from './source/index.js';
export * from './language/index.js';
export * from './symbol/index.js';
export * from './reference/index.js';
export * from './diff/index.js';
export * from './patch/index.js';
export * from './validation/index.js';
export * from './ai/index.js';
export * from './prompt/index.js';
export * from './context/index.js';
export * from './conversation/index.js';
export * from './learning/index.js';
export { deepFreeze } from './agent/types.js';
export * from './agent/types.js';
export * from './agent/base-agent.js';
export * from './agent/agent-runtime.js';
export * from './agent/agent-context.js';
export * from './tools/index.js';
export * from './cli/index.js';

// Explicitly re-export advisors module symbols.
export {
  createAdvisorId,
  createAdvisorCapability,
  createAdvisorProfile,
  AdvisorRoles,
  createAdvisorRoleId,
  Advisor,
  AdvisorFactory,
  AdvisorCatalog,
  AdvisorCapabilities,
  ContextRouter,
  AdvisorOrchestrator,
  AdvisorExecutionPipeline,
} from './advisors/index.js';
export type {
  AdvisorId,
  AdvisorCapability,
  AdvisorProfile,
  AdvisorRoleId,
  IAdvisor,
  AdvisorDefinition,
  IContextRouter,
  RoutingOptions,
  RoutingResult,
  RoutingRule,
  RoutingMatchType,
  IAdvisorOrchestrator,
  OrchestrationPlan,
  OrchestrationStep,
  OrchestrationResult,
  StepResult,
  ExecutionStrategy,
  IAdvisorPromptComposer,
  AdvisorComposeContext,
  AdvisorPromptResult,
  IAdvisorExecutionPipeline,
  AdvisorSessionId,
  CreateAdvisorSessionOptions,
  ExecuteAdvisorStepOptions,
  AdvisorStepResult,
  AdvisorPipelineResult,
  AdvisorExecutionPipelineConfig,
} from './advisors/index.js';
export { InvalidAdvisorSessionError } from './advisors/index.js';

// Explicitly re-export agents module symbols to avoid
// duplicate `AgentEvents` conflict with the agent module.
export {
  AgentPriorities,
  AgentStatus,
  createAgentId,
  createAgentProfile,
  createAgentMetadata,
  AgentCapabilities,
  createCapability,
  AgentRoles,
  createRole,
  AgentState,
  AgentRegistryError,
  AgentAlreadyExistsError,
  AgentNotFoundError,
  InvalidAgentError,
  AgentStateError,
  AgentCapabilityMatcher,
  Agent,
  AgentFactory,
  AgentRegistry,
  AgentManager,
} from './agents/index.js';
export type {
  AgentId,
  AgentPriority,
  AgentProfile,
  AgentMetadata,
  AgentCapability,
  AgentRole,
  AgentRuntimeState,
  IAgentContext,
  IAgentMemory,
  IAgent,
  AgentEventName,
  AgentEventPayload,
  AgentRegisteredPayload,
  AgentRemovedPayload,
  AgentEnabledPayload,
  AgentDisabledPayload,
  AgentActivatedPayload,
  AgentDeactivatedPayload,
  AgentStatusChangedPayload,
  AgentHeartbeatPayload,
  AgentDefinition,
  IAgentRegistry,
  IAgentManager,
} from './agents/index.js';

// Explicitly re-export security module symbols to avoid
// duplicate `CreateSessionOptions` conflict with the context module.
export {
  ISessionManager,
  SessionManager,
  IToolAuthorizationEngine,
  ToolAuthorizationEngine,
  SecurityError,
  SessionNotFoundError,
  SessionExpiredError,
  UnauthorizedToolExecutionError,
  PendingApprovalError,
  ApprovalTokenNotFoundError,
  SecurityEvents,
  SessionStatus,
  SessionState,
  UpdateSessionOptions,
  ToolSensitivity,
  AuthorizationPolicy,
  AuthorizationStatus,
  AuthorizationRule,
  AuthorizationRequest,
  AuthorizationResult,
  PendingApproval,
} from './security/index.js';

// Explicitly re-export CLI module symbols.
export {
  CupawCLI,
  AdvisorCLIHandler,
  CLITurnResult,
  InteractiveCodingSession,
} from './cli/index.js';
export type {
  CLIConfig,
  AdvisorsListOutput,
  AdvisorInfo,
  RouteQueryOutput,
  SwitchAdvisorOutput,
  CLIAdvisorsOutput,
  CodingRequestOptions,
  InteractiveCodingResult,
} from './cli/index.js';

// Explicitly re-export advisor security policy symbols.
export {
  AdvisorSecurityPolicy,
} from './advisors/index.js';
export type {
  IAdvisorSecurityPolicy,
  ToolAccessDecision,
  AdvisorToolScope,
} from './advisors/index.js';

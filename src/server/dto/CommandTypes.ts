/**
 * Data Transfer Object: Command request payload from GUI clients.
 * All commands issued by the GUI must conform to this shape.
 */
export interface CommandRequestDTO {
  readonly command: string;
  readonly args?: Readonly<Record<string, unknown>>;
  readonly sessionId?: string;
  readonly requestId: string;
}

/**
 * Standardized command response sent back to GUI clients.
 */
export interface CommandResponseDTO {
  readonly requestId: string;
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
  readonly timestamp: number;
}

/**
 * Batch command allows multiple commands in a single request.
 */
export interface BatchCommandRequestDTO {
  readonly commands: readonly CommandRequestDTO[];
  readonly requestId: string;
}

export enum CommandType {
  Chat = 'chat',
  AgentExecute = 'agent.execute',
  PlannerPlan = 'planner.plan',
  OrchestratorRun = 'orchestrator.run',
  SessionList = 'session.list',
  SessionInfo = 'session.info',
  SessionClear = 'session.clear',
  AdvisorList = 'advisor.list',
  ToolList = 'tool.list',
  SystemStatus = 'system.status',
}

/**
 * Real-time events broadcast to GUI clients via WebSocket.
 */
export interface EventDTO {
  readonly eventId: string;
  readonly type: string;
  readonly timestamp: number;
  readonly sessionId?: string;
  readonly payload: unknown;
}

export enum EventType {
  AgentStatus = 'agent.status',
  AgentOutput = 'agent.output',
  TaskUpdated = 'task.updated',
  TaskTreeReady = 'task.tree',
  SessionUpdated = 'session.updated',
  ToolRegistered = 'tool.registered',
  ToolExecuted = 'tool.executed',
  PlanCreated = 'plan.created',
  OrchestrationStarted = 'orchestration.started',
  OrchestrationProgress = 'orchestration.progress',
  Error = 'error',
}

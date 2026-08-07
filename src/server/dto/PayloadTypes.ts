/**
 * Serialized agent lifecycle state for transport.
 */
export interface AgentLifecycleStateDTO {
  readonly agentId: string;
  readonly name: string;
  readonly status: string;
  readonly cycleCount: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lastError?: string;
}

/**
 * Serialized task node (DAG) for visualization in GUI.
 */
export interface TaskNodeDTO {
  readonly id: string;
  readonly description: string;
  readonly status: string;
  readonly dependencies: readonly string[];
  readonly assignedAgent?: string;
  readonly result?: unknown;
  readonly error?: string;
}

/**
 * Serialized task tree for transport.
 */
export interface TaskTreeDTO {
  readonly rootId: string;
  readonly nodes: readonly TaskNodeDTO[];
}

/**
 * Serialized session info.
 */
export interface SessionInfoDTO {
  readonly sessionId: string;
  readonly advisorId: string;
  readonly workspaceId: string;
  readonly messageCount: number;
  readonly status: string;
}

/**
 * Serialized tool info.
 */
export interface ToolInfoDTO {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
}

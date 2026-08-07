import type { MemoryBundle } from '../memory/types.js';
import { deepFreeze, cloneValue } from './types.js';

/**
 * Per-agent execution context providing isolated state and memory access.
 *
 * Context isolation: each agent gets its own context keyed by `agentId`.
 * When a {@link MemoryBundle} is supplied, short-term memory is scoped per
 * agent (via the bundle's short-term store keyed by agent id), so two agents
 * never share mutable state. All returned values are deep-cloned and frozen.
 */
export class AgentExecutionContext {
  private readonly agentId: string;
  private readonly memory: MemoryBundle | undefined;
  private readonly local: Map<string, unknown>;
  private projectId: string;

  constructor(agentId: string, memory?: MemoryBundle, projectId = 'default') {
    this.agentId = agentId;
    this.memory = memory;
    this.local = new Map();
    this.projectId = projectId;
  }

  /**
   * Stores a value in the agent's isolated context.
   */
  public remember(key: string, value: unknown): unknown {
    const frozen = deepFreeze(cloneValue(value));
    if (this.memory) {
      this.memory.shortTerm.set(this.agentId, key, frozen);
    } else {
      this.local.set(key, frozen);
    }
    return frozen;
  }

  /**
   * Recalls a value from the agent's isolated context (frozen copy).
   */
  public recall(key: string): unknown {
    if (this.memory) {
      const record = this.memory.shortTerm.get(this.agentId, key);
      return record ? deepFreeze(cloneValue(record.value)) : undefined;
    }
    const value = this.local.get(key);
    return value === undefined ? undefined : deepFreeze(cloneValue(value));
  }

  /**
   * Loads the project-level persistent context via the memory bundle.
   */
  public async getProjectContext(): Promise<unknown> {
    return this.memory?.projectContext?.loadContext(this.projectId);
  }

  /**
   * Sets the project id used for project-context lookups.
   */
  public setProjectId(projectId: string): void {
    this.projectId = projectId;
  }

  /**
   * Returns the owning agent id (immutability guarantee).
   */
  public getAgentId(): string {
    return this.agentId;
  }
}

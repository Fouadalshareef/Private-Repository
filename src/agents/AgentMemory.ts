/**
 * Read-only memory access contract for an agent.
 */
export interface IAgentMemory {
  /**
   * Returns the memory value for the given key, or undefined if absent.
   */
  get(key: string): string | undefined;

  /**
   * Returns all memory entries as a frozen record.
   */
  entries(): Readonly<Record<string, string>>;
}
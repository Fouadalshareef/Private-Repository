/**
 * Read-only context access contract for an agent.
 */
export interface IAgentContext {
  /**
   * Returns the context value for the given key, or undefined if absent.
   */
  get(key: string): string | undefined;

  /**
   * Returns all context entries as a frozen record.
   */
  entries(): Readonly<Record<string, string>>;
}
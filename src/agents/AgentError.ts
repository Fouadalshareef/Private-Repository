/**
 * Base error class for the multi-agent core architecture.
 */
export class AgentRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentRegistryError';
  }
}

/**
 * Error thrown when attempting to register an agent with an id that already exists.
 */
export class AgentAlreadyExistsError extends AgentRegistryError {
  public readonly agentId: string;

  constructor(agentId: string) {
    super(`Agent '${agentId}' is already registered.`);
    this.name = 'AgentAlreadyExistsError';
    this.agentId = agentId;
  }
}

/**
 * Error thrown when an agent cannot be found.
 */
export class AgentNotFoundError extends AgentRegistryError {
  public readonly agentId: string;

  constructor(agentId: string) {
    super(`Agent '${agentId}' was not found.`);
    this.name = 'AgentNotFoundError';
    this.agentId = agentId;
  }
}

/**
 * Error thrown when an agent definition is invalid.
 */
export class InvalidAgentError extends AgentRegistryError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAgentError';
  }
}

/**
 * Error thrown when an agent state transition is invalid.
 */
export class AgentStateError extends AgentRegistryError {
  public readonly agentId: string;
  public readonly currentState: string;
  public readonly attemptedState: string;

  constructor(agentId: string, currentState: string, attemptedState: string) {
    super(
      `Cannot transition agent '${agentId}' from state '${currentState}' to '${attemptedState}'.`,
    );
    this.name = 'AgentStateError';
    this.agentId = agentId;
    this.currentState = currentState;
    this.attemptedState = attemptedState;
  }
}
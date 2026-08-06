/**
 * Base error class for CLI-related failures.
 */
export class CLIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CLIError';
    Object.setPrototypeOf(this, CLIError.prototype);
  }
}

/**
 * Thrown when the CLI cannot initialize the application bootstrap.
 */
export class CLIBootstrapError extends CLIError {
  constructor(message: string) {
    super(message);
    this.name = 'CLIBootstrapError';
    Object.setPrototypeOf(this, CLIBootstrapError.prototype);
  }
}

/**
 * Thrown when an invalid CLI command or argument is provided.
 */
export class CLICommandError extends CLIError {
  constructor(message: string) {
    super(message);
    this.name = 'CLICommandError';
    Object.setPrototypeOf(this, CLICommandError.prototype);
  }
}

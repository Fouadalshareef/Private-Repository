/**
 * Custom error thrown by the {@link Container} for meaningful error reporting.
 */
export class ContainerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContainerError';

    // Restore prototype chain (needed when targeting older ES versions
    // and also good practice for custom errors extending built-in classes).
    Object.setPrototypeOf(this, ContainerError.prototype);
  }
}
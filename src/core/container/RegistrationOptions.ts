/**
 * Options for registering a service in the container.
 */
export interface RegistrationOptions {
  /**
   * If `true` (default), silently replaces an existing registration
   * with the same identifier.
   *
   * If `false`, throws a `ContainerError` when a service with the
   * same identifier is already registered.
   */
  override?: boolean;
}
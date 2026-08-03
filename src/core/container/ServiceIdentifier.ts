/**
 * A unique identifier for a service in the container.
 * Can be a string or a symbol.
 *
 * @template T The type of the service (for type safety at call sites).
 * This is a phantom type parameter — it does not affect the runtime
 * value but enables compile-time type checking when resolving services.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ServiceIdentifier<T = unknown> = string | symbol;

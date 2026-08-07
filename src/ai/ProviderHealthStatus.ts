/**
 * Health status of an AI provider.
 */
export enum ProviderHealthStatus {
  READY = 'ready',
  OFFLINE = 'offline',
  UNAUTHORIZED = 'unauthorized',
  RATE_LIMITED = 'rate_limited',
  UNKNOWN = 'unknown',
}

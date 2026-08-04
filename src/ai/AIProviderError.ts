import { AIProviderType } from './AIProviderType.js';

/**
 * Base error class for AI provider errors.
 */
export class AIProviderError extends Error {
  public readonly providerType: AIProviderType;
  public readonly providerName: string;

  constructor(
    providerType: AIProviderType,
    providerName: string,
    message: string,
  ) {
    super(message);
    this.name = 'AIProviderError';
    this.providerType = providerType;
    this.providerName = providerName;
  }
}

/**
 * Error thrown when a requested provider is not found in the registry.
 */
export class ProviderNotFoundError extends AIProviderError {
  constructor(providerType: AIProviderType, providerName: string) {
    super(
      providerType,
      providerName,
      `AI provider '${providerName}' (${providerType}) not found in registry.`,
    );
    this.name = 'ProviderNotFoundError';
  }
}

/**
 * Error thrown when an API key is missing for a provider.
 */
export class APIKeyMissingError extends AIProviderError {
  constructor(providerType: AIProviderType, providerName: string) {
    super(
      providerType,
      providerName,
      `API key is missing for provider '${providerName}' (${providerType}).`,
    );
    this.name = 'APIKeyMissingError';
  }
}

/**
 * Error thrown when a provider returns an error response.
 */
export class ProviderResponseError extends AIProviderError {
  public readonly statusCode?: number;
  public readonly responseBody?: string;

  constructor(
    providerType: AIProviderType,
    providerName: string,
    message: string,
    statusCode?: number,
    responseBody?: string,
  ) {
    super(providerType, providerName, message);
    this.name = 'ProviderResponseError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

/**
 * Error thrown when a streaming operation fails.
 */
export class ProviderStreamError extends AIProviderError {
  constructor(providerType: AIProviderType, providerName: string, message: string) {
    super(providerType, providerName, message);
    this.name = 'ProviderStreamError';
  }
}
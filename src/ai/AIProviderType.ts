/**
 * Supported AI provider types.
 */
export enum AIProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OLLAMA = 'ollama',
  MOCK = 'mock',
}

/**
 * Returns whether the given provider type is a real provider (not mock).
 */
export function isRealProvider(type: AIProviderType): boolean {
  return type !== AIProviderType.MOCK;
}
import type { IConfiguration } from './IConfiguration.js';
import { AIProviderType } from '../ai/AIProviderType.js';

/**
 * Shape of the AI configuration.
 */
export interface AIConfigShape {
  [key: string]: unknown;
  readonly provider: AIProviderType;
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly timeout: number;
  readonly stream: boolean;
  readonly baseURL: string;
  readonly apiKey: string;
  readonly organization: string;
}

/**
 * Default values for AI configuration.
 */
export const DEFAULT_AI_VALUES: Partial<AIConfigShape> = {
  provider: AIProviderType.MOCK,
  model: 'mock-model-v1',
  temperature: 0.7,
  maxTokens: 1024,
  timeout: 30000,
  stream: false,
  baseURL: '',
  apiKey: '',
  organization: '',
};

/**
 * Strongly-typed AI configuration manager.
 */
export class AIConfig implements IConfiguration<AIConfigShape> {
  private config: Partial<AIConfigShape>;

  constructor(initialValues?: Partial<AIConfigShape>) {
    this.config = { ...DEFAULT_AI_VALUES, ...initialValues };
  }

  get<K extends keyof AIConfigShape>(key: K): AIConfigShape[K] | undefined {
    return this.config[key];
  }

  getOrDefault<K extends keyof AIConfigShape>(key: K, defaultValue: AIConfigShape[K]): AIConfigShape[K] {
    const value = this.config[key];
    return value !== undefined ? (value as AIConfigShape[K]) : defaultValue;
  }

  set<K extends keyof AIConfigShape>(key: K, value: AIConfigShape[K]): void {
    this.config[key] = value;
  }

  has<K extends keyof AIConfigShape>(key: K): boolean {
    return this.config[key] !== undefined;
  }

  reset(): void {
    this.config = { ...DEFAULT_AI_VALUES };
  }

  /**
   * Returns the full configuration as a frozen object.
   */
  toShape(): Readonly<AIConfigShape> {
    return Object.freeze({ ...this.config } as AIConfigShape);
  }
}

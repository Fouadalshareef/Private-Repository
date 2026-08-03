import { Configuration } from './Configuration.js';

/**
 * Defines a basic configuration schema that the system might use by default.
 */
export type DefaultConfigShape = {
  logLevel: string;
  maxMemory: number;
  environment: string;
};

export const DEFAULT_APP_VALUES: Partial<DefaultConfigShape> = {
  logLevel: 'INFO',
  maxMemory: 1024,
  environment: 'development',
};

/**
 * A concrete implementation of the configuration pre-filled with foundational defaults.
 */
export class DefaultConfiguration extends Configuration<DefaultConfigShape> {
  constructor() {
    super(DEFAULT_APP_VALUES);
  }
}

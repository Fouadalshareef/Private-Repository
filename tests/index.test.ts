import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/index.js';

describe('Core Foundation', () => {
  it('should export version', () => {
    expect(VERSION).toBe('1.0.0');
  });
});

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/ui/**/*.js'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
      },
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'docs/', 'scripts/', 'HEAD_*.ts', 'tsc-errors.txt', 'tsc-check.txt', 'lint-check.txt', 'vitest-dot.txt', 'vitest-report.json'],
  }
);

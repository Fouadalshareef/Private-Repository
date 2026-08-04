import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@events': path.resolve(__dirname, './src/events'),
      '@config': path.resolve(__dirname, './src/config'),
      '@logging': path.resolve(__dirname, './src/logging'),
      '@bootstrap': path.resolve(__dirname, './src/bootstrap'),
      '@plugins': path.resolve(__dirname, './src/plugins'),
      '@workspace': path.resolve(__dirname, './src/workspace'),
      '@filesystem': path.resolve(__dirname, './src/filesystem'),
      '@project': path.resolve(__dirname, './src/project'),
      '@model': path.resolve(__dirname, './src/model'),
      '@source': path.resolve(__dirname, './src/source'),
      '@language': path.resolve(__dirname, './src/language'),
      '@ai': path.resolve(__dirname, './src/ai'),
      '@prompt': path.resolve(__dirname, './src/prompt'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
});

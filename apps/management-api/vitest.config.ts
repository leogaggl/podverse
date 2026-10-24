import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { configDefaults, defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@management-api': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'src/**/*.real.integration.test.ts'],
    setupFiles: [
      path.resolve(__dirname, 'vitest.setup.ts'),
      path.resolve(__dirname, 'vitest.setup.stub-sessions.ts'),
    ],
  },
});

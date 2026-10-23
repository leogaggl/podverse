import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Tests that need real `admin_session` rows: the session store is not stubbed. */
export default defineConfig({
  resolve: {
    alias: {
      '@management-api': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.real.integration.test.ts'],
    setupFiles: [path.resolve(__dirname, 'vitest.setup.ts')],
  },
});

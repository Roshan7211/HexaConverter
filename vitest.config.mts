import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// `.mts` so Vite loads this natively as ESM; `__dirname` is not defined there.
const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    globals: false,
    setupFiles: ['./tests/unit/helpers/env.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/lib/**/*.ts',
        'src/utils/**/*.ts',
        'src/services/conversion/registry.ts',
        'src/services/conversion/options.ts',
        'src/services/upload/file-signatures.ts',
      ],
      exclude: ['src/**/*.d.ts'],
    },
  },
  resolve: {
    // `server-only` throws on import outside a React Server Component. Server
    // modules under test are plain Node code, so the marker is stubbed away
    // rather than the modules being restructured to accommodate the test.
    alias: {
      '@': path.resolve(rootDir, './src'),
      'server-only': path.resolve(
        rootDir,
        './tests/unit/helpers/server-only.ts',
      ),
    },
  },
});

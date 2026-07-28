import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
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
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(
        __dirname,
        './tests/unit/helpers/server-only.ts',
      ),
    },
  },
  // esbuild handles the JSX in component tests; no React plugin needed since
  // these render to static markup rather than exercising Fast Refresh.
  esbuild: { jsx: 'automatic' },
});

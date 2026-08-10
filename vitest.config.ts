import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Root Vitest config — BACKEND scope only (Cloudflare Workers / Miniflare).
 *
 * Frontend (React SPA) has its own jsdom-based config at
 * `apps/frontend/vitest.config.ts` and is run via `yarn test:frontend`.
 * Mixing them here would run React components under the Miniflare
 * environment, which has no DOM.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/backend/src'),
    },
  },
  test: {
    environment: 'miniflare',
    include: ['apps/backend/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      // `include` measures every backend source file, not just the ones a test
      // happens to import — so a new untested file lowers the score instead of
      // being silently invisible to the gate.
      include: ['apps/backend/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        // Shared test fixtures/harnesses — not production code.
        'apps/backend/src/test/**',
        // Type-only declarations: no runtime code to exercise.
        '**/*.interface.ts',
        'apps/backend/src/core/types/**',
      ],
      thresholds: {
        lines: 85,
        functions: 90,
        branches: 80,
      },
    },
  },
});

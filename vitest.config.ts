import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'miniflare',
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 85,
        functions: 90,
        branches: 80,
      },
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    // Unit specs live beside code; e2e specs need Postgres + Redis (see README).
    include: ['src/**/*.spec.ts', 'test/e2e/**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup-env.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});

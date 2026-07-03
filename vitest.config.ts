import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Conformance suites iterate hundreds of thousands of cases internally.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // The algorithm modules are the credibility core — gate them hard.
      include: ['src/bidi/**', 'src/shape/**', 'src/api/**'],
      exclude: ['src/data/**', 'src/adapters/**', 'src/index.ts', '**/*.d.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});

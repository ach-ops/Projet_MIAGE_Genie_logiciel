import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

config({ path: '.env.test' });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    isolate: true,
    env: { TZ: 'Europe/Paris' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', 'tests/', 'data/'],
      thresholds: { lines: 80, functions: 80 },
    },
  },
});

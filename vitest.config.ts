import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/__tests__/*.{js,ts}'],
    exclude: ['src/__tests__/example.js', 'src/**/*.bench.ts'],
    coverage: {
      enabled: !!process.env.CI,
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{js,ts}'],
      exclude: ['src/**/__tests__/**', 'src/**/__bench__/**', 'src/index.ts'],
    },
  },
});

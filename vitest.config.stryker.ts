import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/__tests__/*.{js,ts}'],
    exclude: ['src/__tests__/example.js'],
  },
});

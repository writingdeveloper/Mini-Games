import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'public/flight-game/src/**',
        'public/escape-game/**',
        'public/survival-game/src/**',
        'public/desert-game/src/**',
        'public/ppopgi/src/**',
        'server/src/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': '.',
    },
  },
});

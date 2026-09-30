import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      // JS do navegador é coberto pelo E2E (npm run test:e2e); server.js é só o entrypoint.
      exclude: ['src/http/public/**', 'src/server.js'],
      thresholds: {
        lines: 80,
        'src/domain/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
      },
    },
  },
});

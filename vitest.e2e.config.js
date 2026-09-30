import { defineConfig } from 'vitest/config';

// E2E no navegador (Chrome local via playwright-core): npm run test:e2e
export default defineConfig({ test: { include: ['test/e2e/**/*.e2e.js'], testTimeout: 60_000, hookTimeout: 60_000 } });

import { defineConfig } from 'vitest/config';

// Security-rules tests need the Firebase emulator: run them with `npm run test:rules`.
export default defineConfig({
  test: { environment: 'node', include: ['rules-test/**/*.test.ts'], testTimeout: 30_000, hookTimeout: 60_000 },
});

import { defineConfig } from 'vitest/config';
import path from 'path';

// Deliberately separate from vite.config.ts: the app config loads
// lovable-tagger, which has no business running during tests. Only the `@`
// alias is shared, and it is restated here rather than imported so a change
// to the app config cannot silently break module resolution in tests.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});

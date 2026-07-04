import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // One React instance, always — duplicate copies render an empty tree in tests.
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { port: 5174 },
  test: {
    environment: 'jsdom',
  },
});

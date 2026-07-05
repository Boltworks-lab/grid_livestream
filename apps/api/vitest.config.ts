import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    // integration specs boot a throwaway Postgres container
    testTimeout: 120_000,
    hookTimeout: 240_000,
  },
  // NestJS relies on emitDecoratorMetadata, which esbuild (Vitest's default
  // transformer) does not support — transform with SWC instead.
  plugins: [swc.vite({ module: { type: 'es6' } })],
});

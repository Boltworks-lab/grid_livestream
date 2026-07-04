import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
  // NestJS relies on emitDecoratorMetadata, which esbuild (Vitest's default
  // transformer) does not support — transform with SWC instead.
  plugins: [swc.vite({ module: { type: 'es6' } })],
});

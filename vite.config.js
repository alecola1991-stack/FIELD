import { defineConfig } from 'vite';

// The custom domain serves the web game at its root; desktop uses relative assets.
export default defineConfig(({ mode }) => ({
  base: mode === 'desktop' ? './' : '/',
  build: { outDir: mode === 'desktop' ? 'desktop/game' : 'dist' },
}));

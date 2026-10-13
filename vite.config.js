import { defineConfig } from 'vite';

// GitHub Pages serves this repository under /FIELD/ rather than the domain root.
export default defineConfig(({ mode }) => ({
  base: mode === 'desktop' ? './' : process.env.GITHUB_ACTIONS === 'true' ? '/FIELD/' : '/',
  build: { outDir: mode === 'desktop' ? 'desktop/game' : 'dist' },
}));

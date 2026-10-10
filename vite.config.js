import { defineConfig } from 'vite';

// GitHub Pages serves this repository under /FIELD/ rather than the domain root.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? '/FIELD/' : '/',
});

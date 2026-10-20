import { defineConfig } from 'vite';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

// Google AdSense: only the public web build loads it (AdSense does not allow ads in desktop apps).
const ADSENSE_CLIENT = 'ca-pub-8681886004807247';
const adsense = mode => ({
  name: 'field-adsense',
  transformIndexHtml(html) {
    if (mode === 'desktop') return html;
    return html.replace('</head>', `    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>\n  </head>`);
  },
});

// ads.txt only matters to AdSense on the web; the desktop update package only accepts game files
// (html, css, js, images, fonts, audio), so it is left out of the desktop build.
const desktopFiles = mode => ({
  name: 'field-desktop-files',
  closeBundle() { if (mode === 'desktop') rmSync(resolve('desktop/game/ads.txt'), { force: true }); },
});

// The custom domain serves the web game at its root; desktop uses relative assets.
export default defineConfig(({ mode }) => ({
  base: mode === 'desktop' ? './' : '/',
  build: { outDir: mode === 'desktop' ? 'desktop/game' : 'dist' },
  plugins: [adsense(mode), desktopFiles(mode)],
}));

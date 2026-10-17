import { defineConfig } from 'vite';

// Google AdSense: only the public web build loads it (AdSense does not allow ads in desktop apps).
const ADSENSE_CLIENT = 'ca-pub-8681886004807247';
const adsense = mode => ({
  name: 'field-adsense',
  transformIndexHtml(html) {
    if (mode === 'desktop') return html;
    return html.replace('</head>', `    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>\n  </head>`);
  },
});

// The custom domain serves the web game at its root; desktop uses relative assets.
export default defineConfig(({ mode }) => ({
  base: mode === 'desktop' ? './' : '/',
  build: { outDir: mode === 'desktop' ? 'desktop/game' : 'dist' },
  plugins: [adsense(mode)],
}));

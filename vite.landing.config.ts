import path from 'node:path';
import browserslist from 'browserslist';
import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const landingRoot = path.resolve(__dirname, 'src', 'landing-page');
const modernBrowsers = browserslist(undefined, { env: 'modern', path: landingRoot });
const legacyBrowsers = browserslist(undefined, { env: 'legacy', path: landingRoot });

function toEsbuildTargets(browserTargets: readonly string[]): string[] {
  const targets = new Set<string>();

  for (const target of browserTargets) {
    const [browser, version] = target.split(' ');
    const mappedBrowser = browser === 'ios_saf' ? 'safari' : browser === 'and_chr' ? 'chrome' : browser;

    if (['chrome', 'edge', 'firefox', 'safari'].includes(mappedBrowser) && version) {
      targets.add(`${mappedBrowser}${version}`);
    }
  }

  return [...targets];
}

export default defineConfig({
  base: '/gpt-voice/',
  build: {
    cssMinify: 'lightningcss',
    cssTarget: toEsbuildTargets(legacyBrowsers),
    // A standalone landing build owns this directory. The combined Pages build
    // clears it once, then keeps the MkDocs child artifact intact.
    emptyOutDir: process.env.PAGES_BUILD !== '1',
    minify: 'terser',
    outDir: path.resolve(__dirname, 'build', 'github-pages'),
    sourcemap: false,
    terserOptions: {
      compress: {
        drop_debugger: true,
        passes: 2,
      },
      format: {
        comments: false,
      },
      mangle: true,
    },
  },
  plugins: [
    react({}),
    tailwindcss(),
    legacy({
      modernPolyfills: false,
      modernTargets: modernBrowsers,
      renderLegacyChunks: true,
      targets: legacyBrowsers,
    }),
  ],
  publicDir: path.join(landingRoot, 'public'),
  resolve: {
    alias: {
      '@landing': landingRoot,
    },
  },
  root: landingRoot,
});

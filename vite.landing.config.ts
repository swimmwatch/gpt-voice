import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const landingRoot = path.resolve(__dirname, 'src', 'landing-page');

export default defineConfig({
  base: '/gpt-voice/',
  build: {
    emptyOutDir: true,
    outDir: path.resolve(__dirname, 'build', 'github-pages'),
    sourcemap: false,
  },
  plugins: [react({}), tailwindcss()],
  publicDir: path.join(landingRoot, 'public'),
  resolve: {
    alias: {
      '@landing': landingRoot,
    },
  },
  root: landingRoot,
});

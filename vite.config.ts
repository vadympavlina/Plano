/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// The base path must match where the app is served from.
// GitHub Pages project sites live under /<repo-name>/, so the deploy workflow
// sets VITE_BASE_PATH automatically. Locally it defaults to "/".
function normalizeBase(raw: string | undefined): string {
  if (!raw || raw === '/') return '/';
  let base = raw.trim();
  if (!base.startsWith('/') && !base.startsWith('.')) base = `/${base}`;
  if (!base.endsWith('/')) base = `${base}/`;
  return base;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = normalizeBase(env.VITE_BASE_PATH);

  return {
    base,
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          id: base,
          name: 'Plano',
          short_name: 'Plano',
          description: 'Your life. In one place. Plan. Focus. Achieve.',
          theme_color: '#171B24',
          background_color: '#F3F5F9',
          display: 'standalone',
          orientation: 'any',
          start_url: base,
          scope: base,
          categories: ['productivity', 'lifestyle'],
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Only the static app shell is cached. Firebase traffic (auth + realtime
          // database) is never cached by the service worker, so private data is
          // not served from a cache after sign-out.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/__/],
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),
    ],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});

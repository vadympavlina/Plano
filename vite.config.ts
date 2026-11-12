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
      {
        // Open the connection to the Realtime Database while the app JS is still loading.
        name: 'preconnect-database',
        transformIndexHtml: () =>
          env.VITE_FIREBASE_DATABASE_URL
            ? [{ tag: 'link', attrs: { rel: 'preconnect', href: new URL(env.VITE_FIREBASE_DATABASE_URL).origin }, injectTo: 'head' }]
            : [],
      },
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/apple-touch-icon.png', 'logo-duck.png'],
        manifest: {
          // Newer manifest members the plugin's types do not list yet.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          id: base,
          name: 'Plano',
          short_name: 'Plano',
          description: 'Твоє життя. В одному місці. Плануй. Фокусуйся. Досягай.',
          lang: 'uk',
          theme_color: '#0D0D0F',
          background_color: '#0D0D0F',
          display: 'standalone',
          orientation: 'any',
          start_url: base,
          scope: base,
          categories: ['productivity', 'lifestyle'],
          display_override: ['standalone', 'minimal-ui'],
          // «Поділитися → Plano»: the shared text lands in quick add (see ShareTarget).
          share_target: { action: base, method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
          // One window: opening Plano again focuses the running one.
          launch_handler: { client_mode: ['focus-existing', 'auto'] },
          screenshots: [
            { src: 'screenshots/narrow-today.png', sizes: '720x1488', type: 'image/png', form_factor: 'narrow', label: 'Сьогодні: день, задачі й звички' },
            { src: 'screenshots/narrow-tasks.png', sizes: '720x1488', type: 'image/png', form_factor: 'narrow', label: 'Задачі за датами' },
            { src: 'screenshots/narrow-habits.png', sizes: '720x1488', type: 'image/png', form_factor: 'narrow', label: 'Звички й серії' },
            { src: 'screenshots/wide-today.png', sizes: '1280x766', type: 'image/png', form_factor: 'wide', label: 'Сьогодні з боковою карткою' },
            { src: 'screenshots/wide-tasks.png', sizes: '1280x766', type: 'image/png', form_factor: 'wide', label: 'Задачі' },
          ],
          // Long-press on the app icon.
          shortcuts: [
            { name: 'Сьогодні', short_name: 'Сьогодні', url: `${base}#/today`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
            { name: 'Нова задача', short_name: 'Задача', url: `${base}#/tasks?new=1`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
            { name: 'Нова подія', short_name: 'Подія', url: `${base}#/calendar?new=1`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
            { name: 'Звички', short_name: 'Звички', url: `${base}#/habits`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          ],
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
          // iOS fetches launch screens itself when the app is added to the Home Screen.
          globIgnores: ['splash/**', 'screenshots/**'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/__/],
          cleanupOutdatedCaches: true,
          // Push + notification click handlers (public/push-sw.js).
          importScripts: ['push-sw.js'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'firebase';
            if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
            // Everything else from node_modules changes only with dependency updates:
            // a separate chunk stays cached across app releases.
            return 'vendor';
          },
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}', 'worker/src/**/*.test.ts'],
      alias: { 'cloudflare:workers': fileURLToPath(new URL('./worker/src/cf-stub.ts', import.meta.url)) },
    },
  };
});

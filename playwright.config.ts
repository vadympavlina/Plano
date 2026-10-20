import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against a production build in local-preview mode (no Firebase).
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173/', locale: 'uk-UA', timezoneId: 'Europe/Kyiv' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npx vite build --mode e2e --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    // No Firebase key → the app offers the local preview (even if .env.local has one).
    env: { VITE_FIREBASE_API_KEY: '' },
  },
});

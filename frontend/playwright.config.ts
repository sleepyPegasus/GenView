import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // In CI, start dev server. Locally, run `npm run dev` first and use existing server.
  webServer: process.env.CI
    ? {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: false,
        timeout: 120 * 1000,
      }
    : undefined,
});

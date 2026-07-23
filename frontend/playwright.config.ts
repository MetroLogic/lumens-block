import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright E2E configuration.
 * Tests run against the local Next.js dev server (port 3000).
 * The server is started automatically before the test run and stopped after.
 */
export default defineConfig({
  testDir: "./e2e",
  /* Maximum time one test can run */
  timeout: 30_000,
  /* Fail the build on CI if any test is accidentally skipped */
  forbidOnly: !!process.env.CI,
  /* Retry once on CI to reduce flake */
  retries: process.env.CI ? 1 : 0,
  /* Limit parallelism on CI */
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    /* Collect trace on first retry */
    trace: "on-first-retry",
    /* Headless in CI, headed locally when PWDEBUG=1 */
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  /* Auto-start the Next.js dev server */
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

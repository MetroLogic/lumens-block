import { defineConfig, devices } from "@playwright/test"

const PORT = Number(process.env.PORT || 3005)

/**
 * Playwright E2E configuration.
 * Tests run against the local Next.js dev server.
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
    baseURL: `http://localhost:${PORT}`,
    /* Collect trace on first retry */
    trace: "on-first-retry",
    /* Headless in CI, headed locally when PWDEBUG=1 */
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      // Playwright's bundled Chromium 127 (build 1124) is a 212KB stub in this
      // environment and fails to spawn on macOS 27 (`Unknown system error -88`).
      // Locally use the installed Google Chrome; CI still uses bundled Chromium.
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.CI ? {} : { channel: "chrome" }),
      },
    },
  ],
  /* Auto-start the Next.js dev server */
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})

import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./applications/web/tests/e2e",
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm --filter web exec tsx tests/e2e/server.ts",
    url: baseURL,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    env: {
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: "4173",
      PUBLIC_URL: baseURL,
      CREATION_RATE_LIMIT: "100",
      CREATION_RATE_WINDOW_MS: "60000",
    },
  },
});

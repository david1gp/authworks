import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  retries: 0,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "off",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "env UI_PORT=5174 bunx vite --host 127.0.0.1",
    url: "http://127.0.0.1:5174/demo",
    reuseExistingServer: true,
    timeout: 60_000,
  },
})

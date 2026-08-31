import { defineConfig, devices } from "@playwright/test"
import { productionE2eConfigurationResolve } from "./e2e/productionE2eConfigurationResolve.js"

const { productionE2e, testIgnore, testMatch } = productionE2eConfigurationResolve()
const managedOrigin = process.env.AUTHWORKS_E2E_BASE_URL
const localOrigin = managedOrigin ?? "http://127.0.0.1:5174"
const productionOrigin = "https://authworks.contentoren.de"

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  testMatch,
  testIgnore,
  retries: 0,
  timeout: productionE2e ? 180_000 : undefined,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: productionE2e ? productionOrigin : localOrigin,
    trace: "off",
    ...devices["Desktop Chrome"],
  },
  webServer:
    productionE2e || managedOrigin !== undefined
      ? undefined
      : {
          command: "env UI_PORT=5174 bunx vite --host 127.0.0.1",
          url: `${localOrigin}/demo`,
          reuseExistingServer: true,
          timeout: 60_000,
        },
})

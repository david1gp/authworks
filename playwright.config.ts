import { defineConfig, devices } from "@playwright/test"
import { e2eStateDirResolve } from "./e2e/harness/e2eStateDirResolve.js"
import { e2eTargetRequire } from "./e2e/harness/e2eTargetResolve.js"

// Fail closed: no default target. This throw runs at config load, before
// Playwright launches any browser or request (including `playwright --list`).
const resolvedTarget = e2eTargetRequire(process.env)
const target = resolvedTarget.target

const suiteKind = process.env.AUTHWORKS_E2E_SUITE_KIND
const isLive = suiteKind === "live"
const localPortOverride = process.env.AUTHWORKS_E2E_LOCAL_PORT
const localPort = localPortOverride ?? "5174"
if (!isLive && (!/^[1-9]\d*$/.test(localPort) || Number(localPort) > 65535)) {
  throw new Error("AUTHWORKS_E2E_LOCAL_PORT must be an integer between 1 and 65535")
}
const localOrigin = `http://127.0.0.1:${localPort}`

const liveTestMatch = process.env.AUTHWORKS_E2E_TEST_MATCH?.split(",").filter((entry) => entry.length > 0)

const liveTestIgnore =
  process.env.AUTHWORKS_E2E_TEST_IGNORE?.split(",").filter((entry) => entry.length > 0) ?? undefined

const liveArtifactsDir = (() => {
  const stateDir = e2eStateDirResolve()
  if (!stateDir.success) return undefined
  return `${stateDir.data.replace(/\/+$/, "")}/${target}/artifacts`
})()

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  testMatch: isLive ? (liveTestMatch ?? ["**/*.spec.ts"]) : undefined,
  testIgnore: isLive
    ? liveTestIgnore
    : ["**/productionAuthentication.spec.ts", "**/productionAccountRegression.spec.ts"],
  retries: 0,
  timeout: isLive ? 180_000 : undefined,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: isLive ? resolvedTarget.baseUrl : localOrigin,
    trace: isLive ? "retain-on-failure" : "off",
    ...(liveArtifactsDir === undefined ? {} : { outputDir: liveArtifactsDir }),
    ...devices["Desktop Chrome"],
  },
  webServer: isLive
    ? undefined
    : {
        command: `env UI_PORT=${localPort} bunx vite --host 127.0.0.1`,
        url: `${localOrigin}/demo`,
        reuseExistingServer: localPortOverride === undefined,
        timeout: 60_000,
      },
})

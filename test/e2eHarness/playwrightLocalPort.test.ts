import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"

function configRead(port?: string) {
  const env: NodeJS.ProcessEnv = { ...process.env, AUTHWORKS_E2E_SUITE_KIND: "local" }
  delete env.AUTHWORKS_E2E_LOCAL_PORT
  if (port !== undefined) env.AUTHWORKS_E2E_LOCAL_PORT = port
  return spawnSync("bun", ["-e", 'import config from "./playwright.config.ts"; console.log(JSON.stringify(config))'], {
    encoding: "utf8",
    env,
  })
}

test("local Playwright uses the default port and retains server reuse", () => {
  const result = configRead()
  expect(result.status).toBe(0)
  const config = JSON.parse(result.stdout)
  expect(config.use.baseURL).toBe("http://127.0.0.1:5174")
  expect(config.webServer.url).toBe("http://127.0.0.1:5174/demo")
  expect(config.webServer.command).toContain("UI_PORT=5174")
  expect(config.webServer.reuseExistingServer).toBe(true)
})

test("local Playwright uses an override consistently without reusing an existing server", () => {
  const result = configRead("15174")
  expect(result.status).toBe(0)
  const config = JSON.parse(result.stdout)
  expect(config.use.baseURL).toBe("http://127.0.0.1:15174")
  expect(config.webServer.url).toBe("http://127.0.0.1:15174/demo")
  expect(config.webServer.command).toContain("UI_PORT=15174")
  expect(config.webServer.reuseExistingServer).toBe(false)
})

test("local Playwright rejects invalid port overrides", () => {
  for (const port of ["", "0", "65536", "5174;echo bad"]) {
    const result = configRead(port)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain("AUTHWORKS_E2E_LOCAL_PORT must be an integer")
  }
})

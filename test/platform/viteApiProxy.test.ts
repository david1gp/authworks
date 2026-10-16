import { expect, test } from "bun:test"
import viteConfig from "../../vite.config.js"

test("Vite forwards production login discovery and realm requests without intercepting UI routes", async () => {
  const config = await viteConfig({ command: "serve", mode: "development" })
  const proxy = config.server?.proxy ?? {}
  const apiTarget = proxy["/api"]
  expect(apiTarget).toBeDefined()

  for (const path of [
    "/organization-discovery?domain=auth.example",
    "/realms/realm-1/password/login",
    "/realms/realm-1/sessions/current",
    "/realms/realm-1/sessions/csrf",
    "/realms/realm-1/me",
  ]) {
    const matchingPrefix = Object.keys(proxy).find((prefix) => path.startsWith(prefix))
    expect(matchingPrefix).toBeDefined()
    expect(proxy[matchingPrefix ?? ""]).toBe(apiTarget)
  }

  for (const path of ["/login", "/admin/users", "/account", "/demo/login"]) {
    expect(Object.keys(proxy).some((prefix) => path.startsWith(prefix))).toBe(false)
  }
})

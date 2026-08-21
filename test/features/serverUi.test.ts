import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"

test("the composed server serves UI assets and known browser routes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-server-ui-"))
  const uiDirectory = join(directory, "ui")
  await mkdir(join(uiDirectory, "assets"), { recursive: true })
  await writeFile(join(uiDirectory, "index.html"), "<!doctype html><title>Authworks UI</title>")
  await writeFile(join(uiDirectory, "assets", "index-abc123.js"), "console.log('asset')")

  try {
    const created = serverApplicationCreate({
      databasePath: join(directory, "development.sqlite"),
      production: false,
      systemSecret: "server-ui-secret",
      uiDirectory,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    const request = (pathname: string, init?: RequestInit) =>
      created.data.request(`https://ui.example${pathname}`, init)
    const index = await request("/")
    expect(index.status).toBe(200)
    expect(index.headers.get("cache-control")).toBe("no-cache")
    expect(index.headers.get("content-type")).toContain("text/html")

    for (const pathname of ["/login/deep", "/consent", "/account/profile", "/invitations/one", "/admin/users"]) {
      const response = await request(pathname)
      expect(response.status, pathname).toBe(200)
      expect(await response.text(), pathname).toContain("Authworks UI")
    }

    const demo = await request("/demo/login")
    expect(demo.status).toBe(200)

    const asset = await request("/assets/index-abc123.js")
    expect(asset.status).toBe(200)
    expect(asset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable")
    expect(asset.headers.get("content-type")).toContain("text/javascript")

    const api = await request("/system/realms", { headers: { authorization: "Bearer server-ui-secret" } })
    expect(api.status).toBe(200)
    expect(api.headers.get("content-type")).toContain("application/json")
    expect(await api.text()).not.toContain("Authworks UI")

    for (const pathname of ["/assets/missing.js", "/api/not-a-route", "/arbitrary/path"]) {
      const response = await request(pathname)
      expect(response.status, pathname).toBe(404)
    }

    const production = serverApplicationCreate({
      databasePath: join(directory, "production.sqlite"),
      production: true,
      uiDirectory,
    })
    expect(production.success).toBe(true)
    if (!production.success) return
    expect((await production.data.request("https://ui.example/demo/login")).status).toBe(404)
    expect((await production.data.request("https://ui.example/login")).status).toBe(200)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

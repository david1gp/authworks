import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"

test("the composed server serves UI assets and known browser routes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-server-ui-"))
  const uiDirectory = join(directory, "ui")
  await mkdir(join(uiDirectory, "assets"), { recursive: true })
  await mkdir(join(uiDirectory, "demo"), { recursive: true })
  await writeFile(join(uiDirectory, "index.html"), "<!doctype html><title>Authworks UI</title>")
  await writeFile(join(uiDirectory, "assets", "index-abc123.js"), "console.log('asset')")
  await writeFile(join(uiDirectory, "demo", "login"), "demo fixture")
  await writeFile(join(uiDirectory, "favicon.svg"), "<svg></svg>")

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

    const health = await request("/health")
    expect(health.status).toBe(200)
    expect(health.headers.get("cache-control")).toBe("no-store")
    expect(health.headers.get("content-type")).toContain("application/json")
    expect(await health.json()).toEqual({ status: "ok" })

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

    const favicon = await request("/favicon.svg")
    expect(favicon.status).toBe(200)
    expect(favicon.headers.get("cache-control")).toBe("public, max-age=3600")
    expect(favicon.headers.get("content-type")).toContain("image/svg+xml")

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
    const productionDemo = await production.data.request("https://ui.example/demo/login")
    expect(productionDemo.status).toBe(200)
    expect(await productionDemo.text()).toBe("demo fixture")
    const productionDemoFallback = await production.data.request("https://ui.example/demo/admin")
    expect(productionDemoFallback.status).toBe(200)
    expect(await productionDemoFallback.text()).toContain("Authworks UI")
    expect((await production.data.request("https://ui.example/login")).status).toBe(200)
    const productionRoot = await production.data.request("https://ui.example/")
    expect(productionRoot.status).toBe(302)
    expect(productionRoot.headers.get("location")).toBe("/login")
    expect(productionRoot.headers.get("cache-control")).toBe("no-cache")
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

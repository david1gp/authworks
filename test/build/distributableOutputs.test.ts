import { expect, test } from "bun:test"
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { sessionBrowserModeHeaderName } from "../../src/features/sessions/public/sessionBrowserModeHeaderName.js"

type ProcessResult = {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}

test("built library, server, and CLI outputs are executable", async () => {
  const built = await Bun.file("dist/cli/cli.js").exists()
  if (!built) {
    if (process.env.AUTHWORKS_REQUIRE_BUILT_OUTPUTS === "1") throw new Error("The distributable outputs are not built.")
    return
  }

  const uiIndex = Bun.file("dist/ui/index.html")
  expect(await uiIndex.exists()).toBe(true)
  const uiAssets = await readdir("dist/ui/assets")
  expect(uiAssets.length).toBeGreaterThan(0)
  const uiHtml = await uiIndex.text()
  expect(uiHtml).toContain("/assets/")
  expect(uiHtml).toContain('rel="icon"')
  expect(uiHtml).not.toContain("/src/ui/main.tsx")
  expect(await Bun.file("dist/ui/favicon.svg").exists()).toBe(true)

  const packageJson = (await Bun.file("package.json").json()) as { files?: readonly string[] }
  expect(packageJson.files).toContain("dist")
  expect(await Bun.file("dist/package.json").exists()).toBe(true)

  const packageImport = await processRun([
    "bun",
    "-e",
    'const subpaths = ["authorization", "email", "emailOtp", "events", "externalIdentities", "impersonation", "realms", "machineUsers", "mfa", "oidc", "organizations", "passkeys", "passwords", "projects", "sessions", "users"]; const modules = await Promise.all(subpaths.map((path) => import("@adaptive-ds/authworks/" + path))); const root = await import("@adaptive-ds/authworks"); const packageJson = await Bun.file("package.json").json(); if (typeof root.packageName !== "string" || root.packageVersion !== packageJson.version || modules.some((module) => Object.keys(module).length === 0)) process.exit(2)',
  ])
  expect(packageImport).toEqual({ exitCode: 0, stderr: "", stdout: "" })

  const forbiddenPackageImport = await processRun([
    "bun",
    "-e",
    'const result = await import("@adaptive-ds/authworks/features/users").then(() => "ok", () => "fail"); if (result !== "fail") process.exit(2)',
  ])
  expect(forbiddenPackageImport).toEqual({ exitCode: 0, stderr: "", stdout: "" })

  const publicFiles = (await filesWalk("dist/library/features")).filter(
    (filePath) => filePath.includes("/public/") && filePath.endsWith(".js"),
  )
  expect(publicFiles.length).toBeGreaterThan(0)
  const forbiddenLayers = ["domain", "actions", "persistence", "events", "server", "client"]
  const forbiddenFeaturePathPattern = new RegExp(`/features/[^/]+/(?:${forbiddenLayers.join("|")})/`)
  const importPathPattern = /(?:from\s+|import\s*(?:\(\s*)?)["']([^"']+)["']/g
  const violations: string[] = []
  for (const filePath of publicFiles) {
    if (forbiddenFeaturePathPattern.test(filePath)) violations.push(filePath)
    const source = await readFile(filePath, "utf8")
    for (const match of source.matchAll(importPathPattern)) {
      const importedPath = match[1]
      if (importedPath !== undefined && forbiddenFeaturePathPattern.test(importedPath)) {
        violations.push(`${filePath}: ${importedPath}`)
      }
    }
  }
  expect(violations).toEqual([])

  const cliHelp = await processRun(["bun", "dist/cli/cli.js", "--help"])
  expect(cliHelp.exitCode).toBe(0)
  expect(cliHelp.stderr).toBe("")
  expect(cliHelp.stdout).toContain("realms")
  expect(cliHelp.stdout).not.toContain("instances")
  for (const route of [
    "realms",
    "email-otp",
    "external-identities",
    "organizations",
    "oidc",
    "mfa",
    "impersonation",
    "machine-users",
    "passkeys",
    "passwords",
    "projects",
    "sessions",
    "users",
  ]) {
    const routeHelp = await processRun(["bun", "dist/cli/cli.js", route, "--help"])
    expect(routeHelp.exitCode, route).toBe(0)
    expect(routeHelp.stderr, route).toBe("")
    expect(routeHelp.stdout.length, route).toBeGreaterThan(0)
  }

  const cliRealmHelp = await processRun(["bun", "dist/cli/cli.js", "users", "create", "--help"])
  expect(cliRealmHelp.exitCode).toBe(0)
  expect(cliRealmHelp.stderr).toBe("")
  expect(cliRealmHelp.stdout).toContain("--realm-id REALM_ID")
  expect(cliRealmHelp.stdout).toContain("Realm UUID")
  expect(cliRealmHelp.stdout).not.toContain("--instance-id")
  expect(cliRealmHelp.stdout).not.toContain("Instance UUID")

  const directory = await mkdtemp(join(tmpdir(), "authworks-built-outputs-"))
  const child = Bun.spawn(["bun", "dist/server/server.js"], {
    env: {
      ...process.env,
      AUTHWORKS_DATABASE_PATH: join(directory, "authworks.sqlite"),
      AUTHWORKS_PUBLIC_ORIGIN: "https://127.0.0.1:3000",
      AUTHWORKS_SYSTEM_SECRET: "built-output-secret",
      NODE_ENV: "production",
    },
    stderr: "pipe",
    stdout: "pipe",
  })

  try {
    let ready = false
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const response = await fetch("http://127.0.0.1:3000/system/realms", {
          headers: { authorization: "Bearer built-output-secret" },
        })
        if (response.status === 200) {
          ready = true
          break
        }
      } catch (_error) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    }
    expect(ready).toBe(true)

    const indexResponse = await fetch("http://127.0.0.1:3000/", { redirect: "manual" })
    expect(indexResponse.status).toBe(302)
    expect(indexResponse.headers.get("location")).toBe("/login")
    expect(indexResponse.headers.get("cache-control")).toBe("no-cache")

    const healthResponse = await fetch("http://127.0.0.1:3000/health")
    expect(healthResponse.status).toBe(200)
    expect(healthResponse.headers.get("cache-control")).toBe("no-store")
    expect(await healthResponse.json()).toEqual({ status: "ok" })

    const loginResponse = await fetch("http://127.0.0.1:3000/login/deep-link")
    expect(loginResponse.status).toBe(200)
    expect(await loginResponse.text()).toContain('<div id="app">')

    const assetName = uiAssets.find((fileName) => fileName.endsWith(".js"))
    expect(assetName).toBeDefined()
    if (assetName === undefined) return
    const assetResponse = await fetch(`http://127.0.0.1:3000/assets/${assetName}`)
    expect(assetResponse.status).toBe(200)
    expect(assetResponse.headers.get("cache-control")).toBe("public, max-age=31536000, immutable")
    expect(assetResponse.headers.get("content-type")).toContain("text/javascript")

    const faviconResponse = await fetch("http://127.0.0.1:3000/favicon.svg")
    expect(faviconResponse.status).toBe(200)
    expect(faviconResponse.headers.get("cache-control")).toBe("public, max-age=3600")
    expect(faviconResponse.headers.get("content-type")).toContain("image/svg+xml")

    const demoResponse = await fetch("http://127.0.0.1:3000/demo/login")
    expect(demoResponse.status).toBe(200)
    expect(await demoResponse.text()).toContain('<div id="app">')
    expect((await fetch("http://127.0.0.1:3000/assets/missing.js")).status).toBe(404)
    expect((await fetch("http://127.0.0.1:3000/api/not-a-route")).status).toBe(404)

    const cliCreate = await processRun([
      "bun",
      "dist/cli/cli.js",
      "realms",
      "create",
      "--server",
      "http://127.0.0.1:3000",
      "--token",
      "built-output-secret",
      "--domain",
      "built-output.task-20.example",
      "--name",
      "Built output realm",
    ])
    expect(cliCreate.exitCode).toBe(0)
    expect(cliCreate.stderr).toBe("")
    expect(JSON.parse(cliCreate.stdout)).toMatchObject({ realm: { domains: ["built-output.task-20.example"] } })

    const builtRealmId = (JSON.parse(cliCreate.stdout) as { realm: { id: string } }).realm.id
    const registration = await fetch(`http://127.0.0.1:3000/realms/${builtRealmId}/password/register`, {
      body: JSON.stringify({
        email: "browser-mode@built-output.task-20.example",
        password: "Built Output Password 123!",
        profile: { displayName: "Built Output Browser" },
        userName: "built-output-browser",
      }),
      headers: { "content-type": "application/json", host: "built-output.task-20.example" },
      method: "POST",
    })
    expect(registration.status).toBe(200)

    const cliArguments = [
      "--server",
      "http://127.0.0.1:3000",
      "--token",
      "built-output-secret",
      "--realm-id",
      builtRealmId,
    ] as const
    const userListRun = await processRun(["bun", "dist/cli/cli.js", "users", "list", ...cliArguments])
    expect(userListRun.exitCode).toBe(0)
    const builtUserId = (JSON.parse(userListRun.stdout) as { items: { id: string }[] }).items[0]?.id
    expect(builtUserId).toBeDefined()
    if (builtUserId === undefined) return
    for (const [command, state] of [
      ["verify", "verified"],
      ["lifecycle", "active"],
    ] as const) {
      const changed = await processRun([
        "bun",
        "dist/cli/cli.js",
        "users",
        command,
        ...cliArguments,
        "--user-id",
        builtUserId,
        "--state",
        state,
      ])
      expect(changed.exitCode, command).toBe(0)
    }

    const loginAttempt = await fetch(`http://127.0.0.1:3000/realms/${builtRealmId}/password/login`, {
      body: JSON.stringify({
        identifier: "browser-mode@built-output.task-20.example",
        password: "Built Output Password 123!",
      }),
      headers: {
        "content-type": "application/json",
        host: "built-output.task-20.example",
        [sessionBrowserModeHeaderName]: "true",
      },
      method: "POST",
    })
    expect(loginAttempt.status).toBe(200)
    expect(await loginAttempt.text()).not.toContain('"token"')
    const loginCookie = loginAttempt.headers.get("set-cookie") ?? ""
    expect(loginCookie).toContain("HttpOnly")
    expect(loginCookie).toContain("Secure")
    expect(loginCookie).toContain("SameSite=Lax")

    const apiLoginAttempt = await fetch(`http://127.0.0.1:3000/realms/${builtRealmId}/password/login`, {
      body: JSON.stringify({
        identifier: "browser-mode@built-output.task-20.example",
        password: "Built Output Password 123!",
      }),
      headers: { "content-type": "application/json", host: "built-output.task-20.example" },
      method: "POST",
    })
    expect(apiLoginAttempt.status).toBe(200)
    expect(apiLoginAttempt.headers.get("set-cookie")).toBeNull()
    expect(await apiLoginAttempt.text()).toContain('"token"')

    const invalidLoginAttempt = await fetch(`http://127.0.0.1:3000/realms/${builtRealmId}/password/login`, {
      body: JSON.stringify({
        identifier: "browser-mode@built-output.task-20.example",
        password: "Built Output Password 123!",
      }),
      headers: {
        "content-type": "application/json",
        host: "built-output.task-20.example",
        [sessionBrowserModeHeaderName]: "TRUE",
      },
      method: "POST",
    })
    expect(invalidLoginAttempt.status).toBe(200)
    expect(invalidLoginAttempt.headers.get("set-cookie")).toBeNull()
    expect(await invalidLoginAttempt.text()).toContain('"token"')
  } finally {
    child.kill()
    await child.exited
    await rm(directory, { force: true, recursive: true })
  }
})

async function processRun(args: readonly string[]): Promise<ProcessResult> {
  const child = Bun.spawn(Array.from(args), { stderr: "pipe", stdout: "pipe" })
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ])
  return { exitCode, stderr, stdout }
}

async function filesWalk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const filePath = join(directory, entry.name)
      if (entry.isDirectory()) return filesWalk(filePath)
      return [filePath]
    }),
  )
  return nested.flat()
}

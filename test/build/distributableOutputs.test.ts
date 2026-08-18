import { expect, test } from "bun:test"
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

type ProcessResult = {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}

test("built library, server, and CLI outputs are executable", async () => {
  const built = await Bun.file("dist/cli/cli.js").exists()
  if (!built) {
    if (process.env.ZITADEL_V2_REQUIRE_BUILT_OUTPUTS === "1")
      throw new Error("The distributable outputs are not built.")
    return
  }

  const packageImport = await processRun([
    "bun",
    "-e",
    'const subpaths = ["authorization", "emailOtp", "externalIdentities", "impersonation", "realms", "machineUsers", "mfa", "oidc", "organizations", "passkeys", "passwords", "projects", "sessions", "users"]; const modules = await Promise.all(subpaths.map((path) => import("@adaptive-ds/zitadel-v2/" + path))); const root = await import("@adaptive-ds/zitadel-v2"); if (typeof root.packageName !== "string" || modules.some((module) => Object.keys(module).length === 0)) process.exit(2)',
  ])
  expect(packageImport).toEqual({ exitCode: 0, stderr: "", stdout: "" })

  const forbiddenPackageImport = await processRun([
    "bun",
    "-e",
    'const result = await import("@adaptive-ds/zitadel-v2/features/users").then(() => "ok", () => "fail"); if (result !== "fail") process.exit(2)',
  ])
  expect(forbiddenPackageImport).toEqual({ exitCode: 0, stderr: "", stdout: "" })

  const publicFiles = (await filesWalk("dist/library/features")).filter(
    (filePath) => filePath.includes("/public/") && filePath.endsWith(".js"),
  )
  expect(publicFiles.length).toBeGreaterThan(0)
  const forbiddenSegments = ["/domain/", "/actions/", "/persistence/", "/events/", "/server/", "/client/"]
  const importPathPattern = /(?:from\s+|import\s*(?:\(\s*)?)["']([^"']+)["']/g
  const violations: string[] = []
  for (const filePath of publicFiles) {
    if (forbiddenSegments.some((segment) => filePath.includes(segment))) violations.push(filePath)
    const source = await readFile(filePath, "utf8")
    for (const match of source.matchAll(importPathPattern)) {
      const importedPath = match[1]
      if (importedPath !== undefined && forbiddenSegments.some((segment) => importedPath.includes(segment))) {
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

  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-built-outputs-"))
  const child = Bun.spawn(["bun", "dist/server/server.js"], {
    env: {
      ...process.env,
      ZITADEL_V2_DATABASE_PATH: join(directory, "zitadel.sqlite"),
      ZITADEL_V2_PUBLIC_ORIGIN: "http://127.0.0.1:3000",
      ZITADEL_V2_SYSTEM_SECRET: "built-output-secret",
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

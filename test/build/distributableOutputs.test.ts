import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
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
    'const subpaths = ["authorization", "emailOtp", "externalIdentities", "impersonation", "instances", "machineUsers", "mfa", "oidc", "organizations", "passkeys", "passwords", "projects", "sessions", "users"]; const modules = await Promise.all(subpaths.map((path) => import("@adaptive-ds/zitadel-v2/" + path))); const root = await import("@adaptive-ds/zitadel-v2"); if (typeof root.packageName !== "string" || modules.some((module) => Object.keys(module).length === 0)) process.exit(2)',
  ])
  expect(packageImport).toEqual({ exitCode: 0, stderr: "", stdout: "" })

  const cliHelp = await processRun(["bun", "dist/cli/cli.js", "--help"])
  expect(cliHelp.exitCode).toBe(0)
  expect(cliHelp.stderr).toBe("")
  expect(cliHelp.stdout).toContain("instances")
  for (const route of [
    "instances",
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
        const response = await fetch("http://127.0.0.1:3000/system/instances", {
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
      "instances",
      "create",
      "--server",
      "http://127.0.0.1:3000",
      "--token",
      "built-output-secret",
      "--domain",
      "built-output.task-20.example",
      "--name",
      "Built output instance",
    ])
    expect(cliCreate.exitCode).toBe(0)
    expect(cliCreate.stderr).toBe("")
    expect(JSON.parse(cliCreate.stdout)).toMatchObject({ instance: { domains: ["built-output.task-20.example"] } })
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

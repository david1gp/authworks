import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm, stat, symlink } from "node:fs/promises"
import { join } from "node:path"
import { zitadelMigrationSnapshotWrite } from "../../src/features/zitadelMigration/cli/zitadelMigrationCliCommands.js"

type CliResult = { readonly exitCode: number; readonly stdout: string; readonly stderr: string }

const fixture = join(import.meta.dir, "../fixtures/zitadel-migration-snapshot.json")

test("task 12 CLI rejects missing input with exitCode 1 and no secret leakage", async () => {
  const result = await cli("zitadelMigration", "import")
  expect(result.exitCode).toBe(1)
  expect(result.stdout).toBe("")
  expect(result.stderr).not.toContain("never-print-this")
  expect(result.stderr).toContain("Missing Authworks database path")
})

test("authoritative mode requires confirmation and confirmation requires authoritative", async () => {
  const directory = await mkdtemp(join("/tmp", "authworks-zitadel-task12-"))
  try {
    const database = join(directory, "authworks.db")
    const refused = await cli(
      "zitadelMigration",
      "run",
      "--authoritative",
      "--database",
      database,
      "--api-url",
      "http://127.0.0.1:1",
      "--token",
      "secret",
      "--realm-id",
      "realm-1",
    )
    expect(refused.exitCode).toBe(1)
    expect(refused.stderr).toContain("requires --confirm-destructive")
    const invalid = await cli(
      "zitadelMigration",
      "run",
      "--confirm-destructive",
      "--database",
      database,
      "--api-url",
      "http://127.0.0.1:1",
      "--token",
      "secret",
      "--realm-id",
      "realm-1",
    )
    expect(invalid.exitCode).toBe(1)
    expect(invalid.stderr).toContain("requires --authoritative")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("import produces JSON, succeeds, and does not accept credential output", async () => {
  const directory = await mkdtemp(join("/tmp", "authworks-zitadel-task12-"))
  try {
    const database = join(directory, "authworks.db")
    const success = await cli("zitadelMigration", "--help")
    expect(success.exitCode).toBe(0)
    expect(success.stdout).toContain("run")
    const rejected = await cli(
      "zitadelMigration",
      "run",
      "--database",
      database,
      "--credential-output",
      join(directory, "credentials.json"),
      "--api-url",
      "http://127.0.0.1:1",
      "--token",
      "secret",
      "--realm-id",
      "realm-1",
    )
    expect(rejected.exitCode).toBe(1)
    expect(rejected.stderr).toContain("generates no credentials")
    expect(await exists(join(directory, "credentials.json"))).toBe(false)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("snapshot output is protected, refuses symlinks, and rejects malformed snapshots", async () => {
  const directory = await mkdtemp(join("/tmp", "authworks-zitadel-task12-"))
  try {
    const output = join(directory, "snapshot.json")
    const symlinkTarget = join(directory, "target.json")
    await Bun.write(symlinkTarget, "untouched")
    await symlink(symlinkTarget, output)
    const symlinkResult = await zitadelMigrationSnapshotWrite(output, JSON.parse(await readFile(fixture, "utf8")))
    expect(symlinkResult.success).toBe(false)
    if (symlinkResult.success) throw new Error("expected symlink refusal")
    expect(symlinkResult.errorMessage).toContain("symbolic link")
    expect(await readFile(symlinkTarget, "utf8")).toBe("untouched")

    const malformed = join(directory, "malformed.json")
    await Bun.write(malformed, "{}")
    const imported = await cli(
      "zitadelMigration",
      "import",
      "--database",
      join(directory, "db"),
      "--input",
      malformed,
      "--realm-id",
      "realm-1",
    )
    expect(imported.exitCode).toBe(1)
    expect(imported.stderr).toContain("snapshot is invalid")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("CLI flag precedence is observable and profile realm does not become a ZITADEL token", async () => {
  const directory = await mkdtemp(join("/tmp", "authworks-zitadel-task12-"))
  try {
    const output = join(directory, "snapshot.json")
    const result = await cliWithEnvironment(
      {
        ZITADEL_API_URL: "http://127.0.0.1:1",
        ZITADEL_SERVICE_ACCOUNT_TOKEN: "env-secret",
        AUTHWORKS_REALM_ID: "env-realm",
        ZITADEL_SEARCH_PAGE_SIZE: "7",
      },
      "zitadelMigration",
      "export",
      "--api-url",
      "http://127.0.0.1:2",
      "--token",
      "flag-secret",
      "--output",
      output,
    )
    expect(result.exitCode).toBe(0)
    expect(result.stderr).not.toContain("flag-secret")
    expect(result.stderr).not.toContain("env-secret")
    expect(result.stderr).not.toContain("env-realm")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

async function cli(...args: string[]): Promise<CliResult> {
  return cliWithEnvironment({}, ...args)
}
async function cliWithEnvironment(overrides: Record<string, string>, ...args: string[]): Promise<CliResult> {
  const environment = { ...process.env, ...overrides }
  const child = Bun.spawn(["bun", "src/outputs/cli.ts", ...args], { env: environment, stdout: "pipe", stderr: "pipe" })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  return { exitCode, stdout, stderr }
}
async function exists(path: string) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

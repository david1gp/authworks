import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"

type CliRun = {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}

test("CLI account, directory, and events commands expose help", async () => {
  for (const route of [["account"], ["directory"], ["events"]]) {
    const result = await cliRun(...route, "--help")
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout.length).toBeGreaterThan(0)
  }

  const account = await cliRun("account", "effective-access", "--help")
  expect(account.stdout).toContain("--realm-id REALM_ID")
  const directory = await cliRun("directory", "realm-users", "--help")
  expect(directory.stdout).toContain("--realm-id REALM_ID")
  const events = await cliRun("events", "list", "--help")
  expect(events.stdout).toContain("--realm-id REALM_ID")
}, 30_000)

test("CLI account and directory commands require a realm before any request", async () => {
  const unavailableServer = "http://127.0.0.1:1"
  for (const args of [
    ["account", "effective-access", "--server", unavailableServer],
    ["account", "security-history", "--server", unavailableServer],
    ["directory", "realm-users", "--server", unavailableServer],
    ["events", "tenant-list", "--server", unavailableServer],
  ]) {
    const result = await cliRunWithEnvironment({ AUTHWORKS_REALM_ID: undefined }, ...args)
    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).toBe("")
    expect(result.stderr).toBe("Expected input for flag --realm-id\n")
  }
}, 30_000)

test("CLI events system list succeeds through the composed server", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-events-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "cli-events-secret",
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({ fetch: created.data.fetch, port: 0 })
  try {
    const realmCreate = await cliRun(
      "realms",
      "create",
      "--server",
      server.url.toString(),
      "--token",
      "cli-events-secret",
      "--domain",
      "events.example.com",
      "--name",
      "Events realm",
    )
    expect(realmCreate.exitCode).toBe(0)
    const realmId = (JSON.parse(realmCreate.stdout) as { realm: { id: string } }).realm.id

    const listed = await cliRun(
      "events",
      "list",
      "--server",
      server.url.toString(),
      "--system-token",
      "cli-events-secret",
      "--realm-id",
      realmId,
    )
    expect(listed.exitCode).toBe(0)
    expect(listed.stderr).toBe("")
    expect(JSON.parse(listed.stdout)).toMatchObject({ items: [{ realmId }] })
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
}, 30_000)

async function cliRun(...args: string[]): Promise<CliRun> {
  return cliRunWithEnvironment({}, ...args)
}

async function cliRunWithEnvironment(
  environmentOverrides: Record<string, string | undefined>,
  ...args: string[]
): Promise<CliRun> {
  const environment = { ...process.env }
  for (const [name, value] of Object.entries(environmentOverrides)) {
    if (value === undefined) delete environment[name]
    else environment[name] = value
  }

  const child = Bun.spawn(["bun", "src/outputs/cli.ts", ...args], {
    env: environment,
    stderr: "pipe",
    stdout: "pipe",
  })
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ])
  return { exitCode, stderr, stdout }
}

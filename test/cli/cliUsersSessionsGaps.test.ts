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

test("CLI users and sessions gap commands expose help", async () => {
  const users = await cliRun("users", "--help")
  expect(users.exitCode).toBe(0)
  for (const route of [
    "users me\n",
    "users me-delete\n",
    "users me-profile\n",
    "users emails-list\n",
    "users emails-add-start\n",
    "users emails-add-verify\n",
    "users emails-primary-set\n",
    "users emails-remove\n",
    "users tenant-list\n",
    "users tenant-get\n",
    "users tenant-create\n",
    "users tenant-delete\n",
  ]) {
    expect(users.stdout).toContain(route.trim())
  }

  const sessions = await cliRun("sessions", "--help")
  expect(sessions.exitCode).toBe(0)
  for (const route of [
    "me-list",
    "me-revoke",
    "me-revoke-all",
    "user-list",
    "user-revoke",
    "recent-resume",
    "bootstrap-sign-in",
  ]) {
    expect(sessions.stdout).toContain(route)
  }

  const me = await cliRun("users", "me", "--help")
  expect(me.stdout).toContain("--realm-id REALM_ID")
  const bootstrap = await cliRun("sessions", "bootstrap-sign-in", "--help")
  expect(bootstrap.stdout).toContain("--secret SECRET")
  const userList = await cliRun("sessions", "user-list", "--help")
  expect(userList.stdout).toContain("--user-id USER_ID")
}, 30_000)

test("CLI users and sessions gap commands require a realm before any request", async () => {
  const unavailableServer = "http://127.0.0.1:1"
  for (const args of [
    ["users", "me", "--server", unavailableServer],
    ["users", "emails-list", "--server", unavailableServer],
    ["users", "tenant-get", "--server", unavailableServer, "--user-id", "user-id"],
    ["sessions", "me-list", "--server", unavailableServer],
    ["sessions", "recent-resume", "--server", unavailableServer, "--session-id", "session-id"],
    ["sessions", "bootstrap-sign-in", "--server", unavailableServer, "--secret", "secret"],
  ]) {
    const result = await cliRunWithEnvironment({ AUTHWORKS_REALM_ID: undefined }, ...args)
    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).toBe("")
    expect(result.stderr).toBe("Expected input for flag --realm-id\n")
  }
}, 30_000)

test("CLI users me, profile, emails, and tenant commands round trip through the composed server", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-users-gaps-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "cli-users-gaps-secret",
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({ fetch: created.data.fetch, port: 0 })
  const serverUrl = server.url.toString()
  const system = ["--server", serverUrl, "--system-token", "cli-users-gaps-secret"]
  try {
    const realmCreate = await cliRun(
      "realms",
      "create",
      "--server",
      serverUrl,
      "--token",
      "cli-users-gaps-secret",
      "--domain",
      "localhost",
      "--name",
      "Users gaps realm",
    )
    expect(realmCreate.exitCode).toBe(0)
    const realmId = (JSON.parse(realmCreate.stdout) as { realm: { id: string } }).realm.id

    const userCreate = await cliRun(
      "users",
      "create",
      ...system,
      "--realm-id",
      realmId,
      "--user-name",
      "gaps-user",
      "--email",
      "gaps-user@example.com",
    )
    expect(userCreate.exitCode).toBe(0)
    const userId = (JSON.parse(userCreate.stdout) as { user: { id: string } }).user.id

    for (const args of [
      ["users", "lifecycle", ...system, "--realm-id", realmId, "--user-id", userId, "--state", "active"],
      ["users", "verify", ...system, "--realm-id", realmId, "--user-id", userId, "--state", "verified"],
      [
        "passwords",
        "credential-replace",
        ...system,
        "--realm-id",
        realmId,
        "--user-id",
        userId,
        "--password",
        "Correct Horse 12",
      ],
    ]) {
      const result = await cliRun(...args)
      expect(result.exitCode).toBe(0)
    }

    const login = await cliRun(
      "passwords",
      "login",
      "--server",
      serverUrl,
      "--realm-id",
      realmId,
      "--identifier",
      "gaps-user",
      "--password",
      "Correct Horse 12",
    )
    expect(login.exitCode).toBe(0)
    const token = (JSON.parse(login.stdout) as { session: { token: string } }).session.token
    const userAuth = ["--server", serverUrl, "--realm-id", realmId, "--token", token]

    const me = await cliRun("users", "me", ...userAuth)
    expect(me.exitCode).toBe(0)
    expect(JSON.parse(me.stdout)).toMatchObject({ user: { email: "gaps-user@example.com", id: userId } })

    const profile = await cliRun("users", "me-profile", ...userAuth, "--display-name", "Gaps User")
    expect(profile.exitCode).toBe(0)
    expect(JSON.parse(profile.stdout)).toMatchObject({ user: { profile: { displayName: "Gaps User" } } })

    const emails = await cliRun("users", "emails-list", ...userAuth)
    expect(emails.exitCode).toBe(0)
    expect(JSON.parse(emails.stdout)).toMatchObject({ items: [{ email: "gaps-user@example.com", isPrimary: true }] })

    const bootstrap = await cliRun(
      "realms",
      "bootstrap-admin",
      "--server",
      serverUrl,
      "--token",
      "cli-users-gaps-secret",
      "--realm-id",
      realmId,
    )
    expect(bootstrap.exitCode).toBe(0)
    const bootstrapSecret = (JSON.parse(bootstrap.stdout) as { bootstrapAdmin: { secret: string } }).bootstrapAdmin
      .secret
    const tenantAuth = ["--server", serverUrl, "--realm-id", realmId, "--token", bootstrapSecret]

    const tenantList = await cliRun("users", "tenant-list", ...tenantAuth)
    expect(tenantList.exitCode).toBe(0)
    expect(JSON.parse(tenantList.stdout)).toMatchObject({ items: [{ id: userId }] })

    const tenantGet = await cliRun("users", "tenant-get", ...tenantAuth, "--user-id", userId)
    expect(tenantGet.exitCode).toBe(0)
    expect(JSON.parse(tenantGet.stdout)).toMatchObject({ user: { id: userId } })
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
}, 30_000)

test("CLI sessions me-list, current, and me-revoke round trip through the composed server", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-sessions-gaps-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "cli-sessions-gaps-secret",
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({ fetch: created.data.fetch, port: 0 })
  const serverUrl = server.url.toString()
  const system = ["--server", serverUrl, "--system-token", "cli-sessions-gaps-secret"]
  try {
    const realmCreate = await cliRun(
      "realms",
      "create",
      "--server",
      serverUrl,
      "--token",
      "cli-sessions-gaps-secret",
      "--domain",
      "localhost",
      "--name",
      "Sessions gaps realm",
    )
    expect(realmCreate.exitCode).toBe(0)
    const realmId = (JSON.parse(realmCreate.stdout) as { realm: { id: string } }).realm.id

    const userCreate = await cliRun(
      "users",
      "create",
      ...system,
      "--realm-id",
      realmId,
      "--user-name",
      "sessions-gaps-user",
      "--email",
      "sessions-gaps-user@example.com",
    )
    expect(userCreate.exitCode).toBe(0)
    const userId = (JSON.parse(userCreate.stdout) as { user: { id: string } }).user.id

    for (const args of [
      ["users", "lifecycle", ...system, "--realm-id", realmId, "--user-id", userId, "--state", "active"],
      ["users", "verify", ...system, "--realm-id", realmId, "--user-id", userId, "--state", "verified"],
      [
        "passwords",
        "credential-replace",
        ...system,
        "--realm-id",
        realmId,
        "--user-id",
        userId,
        "--password",
        "Correct Horse 12",
      ],
    ]) {
      const result = await cliRun(...args)
      expect(result.exitCode).toBe(0)
    }

    const firstLogin = await cliRun(
      "passwords",
      "login",
      "--server",
      serverUrl,
      "--realm-id",
      realmId,
      "--identifier",
      "sessions-gaps-user",
      "--password",
      "Correct Horse 12",
    )
    expect(firstLogin.exitCode).toBe(0)
    const firstSession = JSON.parse(firstLogin.stdout) as { session: { session: { id: string }; token: string } }

    const secondLogin = await cliRun(
      "passwords",
      "login",
      "--server",
      serverUrl,
      "--realm-id",
      realmId,
      "--identifier",
      "sessions-gaps-user",
      "--password",
      "Correct Horse 12",
    )
    expect(secondLogin.exitCode).toBe(0)
    const secondSession = JSON.parse(secondLogin.stdout) as { session: { session: { id: string }; token: string } }
    const secondAuth = ["--server", serverUrl, "--realm-id", realmId, "--token", secondSession.session.token]

    const listed = await cliRun("sessions", "me-list", ...secondAuth)
    expect(listed.exitCode).toBe(0)
    const listedItems = (JSON.parse(listed.stdout) as { items: { current: boolean; id: string }[] }).items
    expect(listedItems.map((item) => item.id).sort()).toEqual(
      [firstSession.session.session.id, secondSession.session.session.id].sort(),
    )

    const current = await cliRun("sessions", "current", ...secondAuth)
    expect(current.exitCode).toBe(0)
    expect(JSON.parse(current.stdout)).toMatchObject({
      session: { current: true, id: secondSession.session.session.id },
    })

    const revoked = await cliRun(
      "sessions",
      "me-revoke",
      ...secondAuth,
      "--session-id",
      firstSession.session.session.id,
    )
    expect(revoked.exitCode).toBe(0)
    expect(JSON.parse(revoked.stdout)).toEqual({ revoked: true })

    const relisted = await cliRun("sessions", "me-list", ...secondAuth)
    expect(relisted.exitCode).toBe(0)
    const relistedItems = (JSON.parse(relisted.stdout) as { items: { id: string; revokedAt: number | null }[] }).items
    expect(relistedItems).toHaveLength(2)
    expect(relistedItems.find((item) => item.id === firstSession.session.session.id)?.revokedAt).toEqual(
      expect.any(Number),
    )
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

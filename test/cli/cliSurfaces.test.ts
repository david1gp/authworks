import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { httpDateFormat } from "../../src/platform/http/httpDateFormat.js"

type CliRun = {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}

const featureRoutes = [
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
  "whatsapp-otp",
  "zitadel-migration",
]

test("every completed feature command tree has clean subprocess help", async () => {
  const root = await cliRun("--help")
  expect(root.exitCode).toBe(0)
  expect(root.stdout).toContain("realms")
  expect(root.stdout).not.toContain("instances")
  expect(root.stdout).not.toContain("Authworks scaffold")
  expect(root.stdout).not.toContain("status")

  for (const route of featureRoutes) {
    const result = await cliRun(route, "--help")
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout.length).toBeGreaterThan(0)
  }
})

test("CLI realm identifiers use the realm flag and vocabulary", async () => {
  const result = await cliRun("users", "create", "--help")
  expect(result.exitCode).toBe(0)
  expect(result.stderr).toBe("")
  expect(result.stdout).toContain("--realm-id REALM_ID")
  expect(result.stdout).toContain("Realm UUID")
  expect(result.stdout).not.toContain("--instance-id")
  expect(result.stdout).not.toContain("Instance UUID")
})

test("CLI scoped commands use environment defaults and explicit flags take precedence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-scope-defaults-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "cli-scope-secret",
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({
    fetch: created.data.fetch,
    port: 0,
  })

  try {
    const realmCreate = await cliRun(
      "realms",
      "create",
      "--server",
      server.url.toString(),
      "--token",
      "cli-scope-secret",
      "--domain",
      "scope-defaults.example.com",
      "--name",
      "Scope defaults realm",
    )
    expect(realmCreate.exitCode).toBe(0)
    const realmId = (JSON.parse(realmCreate.stdout) as { realm: { id: string } }).realm.id

    const realmDefault = await cliRunWithEnvironment(
      { AUTHWORKS_REALM_ID: realmId },
      "users",
      "list",
      "--server",
      server.url.toString(),
      "--token",
      "cli-scope-secret",
    )
    expect(realmDefault.exitCode).toBe(0)
    expect(realmDefault.stderr).toBe("")
    expect(JSON.parse(realmDefault.stdout)).toMatchObject({ items: [] })

    const organizationCreate = await cliRunWithEnvironment(
      { AUTHWORKS_REALM_ID: realmId },
      "organizations",
      "create",
      "--server",
      server.url.toString(),
      "--token",
      "cli-scope-secret",
      "--name",
      "Scope defaults organization",
    )
    expect(organizationCreate.exitCode).toBe(0)
    const organizationId = (JSON.parse(organizationCreate.stdout) as { organization: { id: string } }).organization.id

    const organizationDefault = await cliRunWithEnvironment(
      { AUTHWORKS_REALM_ID: realmId, AUTHWORKS_ORGANIZATION_ID: organizationId },
      "organizations",
      "get",
      "--server",
      server.url.toString(),
      "--token",
      "cli-scope-secret",
    )
    expect(organizationDefault.exitCode).toBe(0)
    expect(organizationDefault.stderr).toBe("")
    expect(JSON.parse(organizationDefault.stdout)).toMatchObject({ organization: { id: organizationId } })

    const realmFlagPrecedence = await cliRunWithEnvironment(
      { AUTHWORKS_REALM_ID: "environment-realm-is-ignored" },
      "users",
      "list",
      "--server",
      server.url.toString(),
      "--token",
      "cli-scope-secret",
      "--realm-id",
      realmId,
    )
    expect(realmFlagPrecedence.exitCode).toBe(0)
    expect(realmFlagPrecedence.stderr).toBe("")

    const organizationFlagPrecedence = await cliRunWithEnvironment(
      {
        AUTHWORKS_ORGANIZATION_ID: "environment-organization-is-ignored",
        AUTHWORKS_REALM_ID: "environment-realm-is-ignored",
      },
      "organizations",
      "get",
      "--server",
      server.url.toString(),
      "--token",
      "cli-scope-secret",
      "--realm-id",
      realmId,
      "--organization-id",
      organizationId,
    )
    expect(organizationFlagPrecedence.exitCode).toBe(0)
    expect(organizationFlagPrecedence.stderr).toBe("")
    expect(JSON.parse(organizationFlagPrecedence.stdout)).toMatchObject({ organization: { id: organizationId } })
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

test("CLI reports missing required scope IDs before making an API request", async () => {
  const unavailableServer = "http://127.0.0.1:1"
  const missingRealm = await cliRunWithEnvironment(
    { AUTHWORKS_REALM_ID: undefined },
    "users",
    "list",
    "--server",
    unavailableServer,
  )
  expect(missingRealm.exitCode).not.toBe(0)
  expect(missingRealm.stdout).toBe("")
  expect(missingRealm.stderr).toBe("Expected input for flag --realm-id\n")

  const blankRealm = await cliRunWithEnvironment(
    { AUTHWORKS_REALM_ID: "" },
    "users",
    "list",
    "--server",
    unavailableServer,
  )
  expect(blankRealm.exitCode).not.toBe(0)
  expect(blankRealm.stdout).toBe("")
  expect(blankRealm.stderr).toBe("Expected input for flag --realm-id\n")

  const missingOrganization = await cliRunWithEnvironment(
    { AUTHWORKS_ORGANIZATION_ID: undefined },
    "organizations",
    "get",
    "--server",
    unavailableServer,
    "--realm-id",
    "realm-id",
  )
  expect(missingOrganization.exitCode).not.toBe(0)
  expect(missingOrganization.stdout).toBe("")
  expect(missingOrganization.stderr).toBe("Expected input for flag --organization-id\n")
})

test("CLI reports transport errors and succeeds through the composed server", async () => {
  const unavailable = await cliRun("realms", "list", "--server", "http://127.0.0.1:1")
  expect(unavailable.exitCode).not.toBe(0)
  expect(unavailable.stdout).toBe("")
  expect(unavailable.stderr).toContain("could not be reached")

  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-surfaces-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "cli-system-secret",
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({
    fetch: created.data.fetch,
    port: 0,
  })
  try {
    const available = await cliRun(
      "realms",
      "create",
      "--server",
      server.url.toString(),
      "--token",
      "cli-system-secret",
      "--domain",
      "cli.example.com",
      "--name",
      "CLI realm",
    )
    expect(available.exitCode).toBe(0)
    expect(available.stderr).toBe("")
    expect(JSON.parse(available.stdout)).toMatchObject({ realm: { domains: ["cli.example.com"] } })
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

test("CLI conditional project GET reports 304 without a body", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-conditional-get-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "cli-conditional-secret",
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({
    fetch: created.data.fetch,
    port: 0,
  })

  try {
    const realmCreate = await cliRun(
      "realms",
      "create",
      "--server",
      server.url.toString(),
      "--token",
      "cli-conditional-secret",
      "--domain",
      "conditional.example.com",
      "--name",
      "Conditional realm",
    )
    expect(realmCreate.exitCode).toBe(0)
    const realmId = (JSON.parse(realmCreate.stdout) as { realm: { id: string } }).realm.id

    const organizationCreate = await cliRun(
      "organizations",
      "create",
      "--server",
      server.url.toString(),
      "--token",
      "cli-conditional-secret",
      "--realm-id",
      realmId,
      "--name",
      "Conditional organization",
    )
    expect(organizationCreate.exitCode).toBe(0)
    const organizationId = (JSON.parse(organizationCreate.stdout) as { organization: { id: string } }).organization.id

    const projectCreate = await cliRun(
      "projects",
      "create",
      "--server",
      server.url.toString(),
      "--token",
      "cli-conditional-secret",
      "--realm-id",
      realmId,
      "--organization-id",
      organizationId,
      "--name",
      "Conditional project",
    )
    expect(projectCreate.exitCode).toBe(0)
    const projectId = (JSON.parse(projectCreate.stdout) as { project: { id: string } }).project.id

    const projectGet = await cliRun(
      "projects",
      "get",
      "--server",
      server.url.toString(),
      "--token",
      "cli-conditional-secret",
      "--realm-id",
      realmId,
      "--project-id",
      projectId,
    )
    expect(projectGet.exitCode).toBe(0)
    const updatedAt = (JSON.parse(projectGet.stdout) as { project: { updatedAt: number } }).project.updatedAt

    const unchanged = await cliRun(
      "projects",
      "get",
      "--server",
      server.url.toString(),
      "--token",
      "cli-conditional-secret",
      "--realm-id",
      realmId,
      "--project-id",
      projectId,
      "--if-modified-since",
      httpDateFormat(new Date(updatedAt)),
    )
    expect(unchanged.exitCode).toBe(0)
    expect(unchanged.stdout).toBe("")
    expect(unchanged.stderr).toBe("304 Not Modified\n")
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

async function cliRun(...args: string[]): Promise<CliRun> {
  return cliRunWithEnvironment({}, ...args)
}

async function cliRunWithEnvironment(environmentOverrides: Record<string, string | undefined>, ...args: string[]) {
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

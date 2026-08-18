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
]

test("every completed feature command tree has clean subprocess help", async () => {
  const root = await cliRun("--help")
  expect(root.exitCode).toBe(0)
  expect(root.stdout).toContain("realms")
  expect(root.stdout).not.toContain("instances")
  expect(root.stdout).not.toContain("ZITADEL v2 scaffold")
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
  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-cli-scope-defaults-"))
  const server = Bun.serve({
    fetch: serverApplicationCreate({
      databasePath: join(directory, "zitadel.sqlite"),
      systemSecret: "cli-scope-secret",
    }).fetch,
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
      { ZITADEL_V2_REALM_ID: realmId },
      "users",
      "list",
      "--server",
      server.url.toString(),
      "--token",
      "cli-scope-secret",
    )
    expect(realmDefault.exitCode).toBe(0)
    expect(realmDefault.stderr).toBe("")
    expect(JSON.parse(realmDefault.stdout)).toMatchObject({ users: [] })

    const organizationCreate = await cliRunWithEnvironment(
      { ZITADEL_V2_REALM_ID: realmId },
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
      { ZITADEL_V2_REALM_ID: realmId, ZITADEL_V2_ORGANIZATION_ID: organizationId },
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
      { ZITADEL_V2_REALM_ID: "environment-realm-is-ignored" },
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
        ZITADEL_V2_ORGANIZATION_ID: "environment-organization-is-ignored",
        ZITADEL_V2_REALM_ID: "environment-realm-is-ignored",
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
    { ZITADEL_V2_REALM_ID: undefined },
    "users",
    "list",
    "--server",
    unavailableServer,
  )
  expect(missingRealm.exitCode).not.toBe(0)
  expect(missingRealm.stdout).toBe("")
  expect(missingRealm.stderr).toBe("Expected input for flag --realm-id\n")

  const blankRealm = await cliRunWithEnvironment(
    { ZITADEL_V2_REALM_ID: "" },
    "users",
    "list",
    "--server",
    unavailableServer,
  )
  expect(blankRealm.exitCode).not.toBe(0)
  expect(blankRealm.stdout).toBe("")
  expect(blankRealm.stderr).toBe("Expected input for flag --realm-id\n")

  const missingOrganization = await cliRunWithEnvironment(
    { ZITADEL_V2_ORGANIZATION_ID: undefined },
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

  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-cli-surfaces-"))
  const server = Bun.serve({
    fetch: serverApplicationCreate({
      databasePath: join(directory, "zitadel.sqlite"),
      systemSecret: "cli-system-secret",
    }).fetch,
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

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

test("CLI organization and realm gap commands expose help", async () => {
  for (const route of [
    ["organizations", "me-list"],
    ["organizations", "branding-get"],
    ["organizations", "domain-remove"],
    ["organizations", "domain-discover"],
    ["organizations", "domain-seed"],
    ["organizations", "invitation-me-list"],
    ["organizations", "invitation-me-accept"],
    ["organizations", "invitation-me-decline"],
    ["organizations", "invitation-me-inspect"],
    ["organizations", "me-switch"],
    ["organizations", "purge"],
    ["realms", "get"],
    ["realms", "update"],
    ["realms", "tenant-get"],
    ["realms", "tenant-update"],
    ["realms", "tenant-administrator-list"],
    ["realms", "tenant-administrator-grant"],
    ["realms", "tenant-administrator-revoke"],
  ]) {
    const result = await cliRun(...route, "--help")
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout.length).toBeGreaterThan(0)
  }

  const meList = await cliRun("organizations", "me-list", "--help")
  expect(meList.stdout).toContain("--realm-id REALM_ID")
  const brandingGet = await cliRun("organizations", "branding-get", "--help")
  expect(brandingGet.stdout).toContain("--organization-id ORGANIZATION_ID")
  const purge = await cliRun("organizations", "purge", "--help")
  expect(purge.stdout).toContain("--organization-id ORGANIZATION_ID")
  const domainSeed = await cliRun("organizations", "domain-seed", "--help")
  expect(domainSeed.stdout).toContain("--domain VALUE")
  const invitationInspect = await cliRun("organizations", "invitation-me-inspect", "--help")
  expect(invitationInspect.stdout).toContain("--invitation-token VALUE")
  const realmGet = await cliRun("realms", "get", "--help")
  expect(realmGet.stdout).toContain("--realm-id REALM_ID")
  const tenantGet = await cliRun("realms", "tenant-get", "--help")
  expect(tenantGet.stdout).toContain("--realm-id REALM_ID")
  const tenantUpdate = await cliRun("realms", "tenant-update", "--help")
  expect(tenantUpdate.stdout).toContain("--name NAME")
}, 30_000)

test("CLI organization and realm gap commands require scope before any request", async () => {
  const unavailableServer = "http://127.0.0.1:1"
  for (const args of [
    ["organizations", "me-list", "--server", unavailableServer],
    ["organizations", "invitation-me-list", "--server", unavailableServer],
    ["organizations", "invitation-me-accept", "--server", unavailableServer, "--invitation-token", "token"],
    ["organizations", "invitation-me-decline", "--server", unavailableServer, "--invitation-token", "token"],
    ["organizations", "invitation-me-inspect", "--server", unavailableServer, "--invitation-token", "token"],
    ["realms", "get", "--server", unavailableServer],
    ["realms", "update", "--server", unavailableServer, "--name", "Renamed"],
    ["realms", "tenant-get", "--server", unavailableServer],
    ["realms", "tenant-update", "--server", unavailableServer, "--name", "Renamed"],
    ["realms", "tenant-administrator-list", "--server", unavailableServer],
  ]) {
    const result = await cliRunWithEnvironment({ AUTHWORKS_REALM_ID: undefined }, ...args)
    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).toBe("")
    expect(result.stderr).toBe("Expected input for flag --realm-id\n")
  }

  for (const args of [
    ["organizations", "branding-get", "--server", unavailableServer],
    ["organizations", "domain-remove", "--server", unavailableServer, "--domain", "example.com"],
    ["organizations", "domain-seed", "--server", unavailableServer, "--domain", "example.com"],
    ["organizations", "me-switch", "--server", unavailableServer],
    ["organizations", "purge", "--server", unavailableServer],
  ]) {
    const result = await cliRunWithEnvironment(
      { AUTHWORKS_ORGANIZATION_ID: undefined, AUTHWORKS_REALM_ID: undefined },
      ...args,
    )
    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).toBe("")
    expect(result.stderr).toBe("Expected input for flag --realm-id\nExpected input for flag --organization-id\n")
  }

  const domainRemove = await cliRunWithEnvironment(
    { AUTHWORKS_ORGANIZATION_ID: undefined, AUTHWORKS_REALM_ID: "00000000-0000-4000-8000-000000000000" },
    "organizations",
    "domain-remove",
    "--server",
    unavailableServer,
    "--domain",
    "example.com",
  )
  expect(domainRemove.exitCode).not.toBe(0)
  expect(domainRemove.stdout).toBe("")
  expect(domainRemove.stderr).toBe("Expected input for flag --organization-id\n")
}, 30_000)

test("CLI organization branding get succeeds through the composed server", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-orgs-gaps-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "orgs-gaps-secret",
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
      "orgs-gaps-secret",
      "--domain",
      "orgs-gaps.example.com",
      "--name",
      "Orgs gaps realm",
    )
    expect(realmCreate.exitCode).toBe(0)
    const realmId = (JSON.parse(realmCreate.stdout) as { realm: { id: string } }).realm.id

    const organizationCreate = await cliRun(
      "organizations",
      "create",
      "--server",
      server.url.toString(),
      "--token",
      "orgs-gaps-secret",
      "--realm-id",
      realmId,
      "--name",
      "Orgs gaps organization",
    )
    expect(organizationCreate.exitCode).toBe(0)
    const organizationId = (JSON.parse(organizationCreate.stdout) as { organization: { id: string } }).organization.id

    const brandingGet = await cliRun(
      "organizations",
      "branding-get",
      "--server",
      server.url.toString(),
      "--token",
      "orgs-gaps-secret",
      "--realm-id",
      realmId,
      "--organization-id",
      organizationId,
    )
    expect(brandingGet.exitCode).toBe(0)
    expect(brandingGet.stderr).toBe("")
    expect(JSON.parse(brandingGet.stdout)).toMatchObject({ branding: {} })

    const discovered = await cliRun(
      "organizations",
      "domain-discover",
      "--server",
      server.url.toString(),
      "--token",
      "orgs-gaps-secret",
      "--domain",
      "unknown-orgs-gaps.example.com",
    )
    expect(discovered.exitCode).toBe(0)
    expect(discovered.stderr).toBe("")
    expect(JSON.parse(discovered.stdout)).toMatchObject({ found: false })
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
}, 30_000)

test("CLI realm get and update succeed through the composed server", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-realms-gaps-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "realms-gaps-secret",
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
      "realms-gaps-secret",
      "--domain",
      "realms-gaps.example.com",
      "--name",
      "Realms gaps realm",
    )
    expect(realmCreate.exitCode).toBe(0)
    const realmId = (JSON.parse(realmCreate.stdout) as { realm: { id: string } }).realm.id

    const realmGet = await cliRun(
      "realms",
      "get",
      "--server",
      server.url.toString(),
      "--token",
      "realms-gaps-secret",
      "--realm-id",
      realmId,
    )
    expect(realmGet.exitCode).toBe(0)
    expect(realmGet.stderr).toBe("")
    expect(JSON.parse(realmGet.stdout)).toMatchObject({ realm: { id: realmId } })

    const realmUpdate = await cliRun(
      "realms",
      "update",
      "--server",
      server.url.toString(),
      "--token",
      "realms-gaps-secret",
      "--realm-id",
      realmId,
      "--name",
      "Renamed gaps realm",
    )
    expect(realmUpdate.exitCode).toBe(0)
    expect(realmUpdate.stderr).toBe("")
    expect(JSON.parse(realmUpdate.stdout)).toMatchObject({ realm: { id: realmId, name: "Renamed gaps realm" } })
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

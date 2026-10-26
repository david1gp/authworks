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

const oidcGapRoutes: string[][] = [
  ["oidc", "client-lifecycle-set"],
  ["oidc", "client-secret-revoke"],
  ["oidc", "key-lifecycle-set"],
  ["oidc", "key-ensure-active"],
  ["oidc", "consent-me-list"],
  ["oidc", "consent-me-revoke"],
  ["oidc", "refresh-token-me-list"],
  ["oidc", "refresh-token-me-revoke"],
  ["oidc", "refresh-token-me-revoke-all"],
  ["oidc", "discovery-get"],
  ["oidc", "jwks-get"],
  ["oidc", "token-revoke"],
]

const mfaGapRoutes: string[][] = [
  ["mfa", "totp-remove"],
  ["mfa", "totp-rename"],
  ["mfa", "totp-verify"],
  ["mfa", "step-up-start"],
  ["mfa", "step-up-complete"],
  ["mfa", "challenge-complete"],
  ["mfa", "challenge-factor-select"],
  ["mfa", "email-otp-start"],
  ["mfa", "recovery-verify"],
]

test("CLI OIDC and MFA gap commands expose help", async () => {
  for (const route of [...oidcGapRoutes, ...mfaGapRoutes]) {
    const result = await cliRun(...route, "--help")
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout.length).toBeGreaterThan(0)
  }

  const lifecycle = await cliRun("oidc", "client-lifecycle-set", "--help")
  expect(lifecycle.stdout).toContain("--realm-id UUID")
  expect(lifecycle.stdout).toContain("--status STATUS")

  const tokenRevoke = await cliRun("oidc", "token-revoke", "--help")
  expect(tokenRevoke.stdout).toContain("--revoked-token VALUE")

  const discovery = await cliRun("oidc", "discovery-get", "--help")
  expect(discovery.stdout).toContain("--profile NAME")

  const stepUp = await cliRun("mfa", "step-up-complete", "--help")
  expect(stepUp.stdout).toContain("--challenge-token VALUE")
  expect(stepUp.stdout).toContain("--realm-id REALM_ID")
}, 30_000)

test("CLI OIDC and MFA gap commands require a realm before any request", async () => {
  const unavailableServer = "http://127.0.0.1:1"
  for (const args of [
    [
      "oidc",
      "client-lifecycle-set",
      "--server",
      unavailableServer,
      "--system-token",
      "secret",
      "--client-id",
      "01900000-0000-7000-8000-000000000000",
      "--status",
      "inactive",
    ],
    [
      "oidc",
      "client-secret-revoke",
      "--server",
      unavailableServer,
      "--system-token",
      "secret",
      "--client-id",
      "01900000-0000-7000-8000-000000000000",
    ],
    ["oidc", "key-ensure-active", "--server", unavailableServer, "--system-token", "secret"],
    ["oidc", "consent-me-list", "--server", unavailableServer],
    ["oidc", "refresh-token-me-list", "--server", unavailableServer],
    ["mfa", "totp-verify", "--server", unavailableServer, "--code", "123456"],
    ["mfa", "totp-rename", "--server", unavailableServer, "--enrollment-id", "enrollment", "--label", "label"],
    ["mfa", "step-up-start", "--server", unavailableServer],
    ["mfa", "recovery-verify", "--server", unavailableServer, "--code", "ABCD-1234"],
  ]) {
    const result = await cliRunWithEnvironment({ AUTHWORKS_REALM_ID: undefined }, ...args)
    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).toBe("")
    expect(result.stderr).toBe("Expected input for flag --realm-id\n")
  }
}, 30_000)

test("CLI OIDC client update exposes application flags and rejects conflicting clear", async () => {
  const help = await cliRun("oidc", "client-update", "--help")
  expect(help.exitCode).toBe(0)
  expect(help.stderr).toBe("")
  expect(help.stdout).toContain("--application-id")
  expect(help.stdout).toContain("--clear-application-id")

  const conflict = await cliRunWithEnvironment(
    { AUTHWORKS_REALM_ID: "11111111-1111-1111-1111-111111111111" },
    "oidc",
    "client-update",
    "--server",
    "http://127.0.0.1:1",
    "--system-token",
    "secret",
    "--client-id",
    "22222222-2222-2222-2222-222222222222",
    "--application-id",
    "33333333-3333-3333-3333-333333333333",
    "--clear-application-id",
  )
  expect(conflict.exitCode).toBe(1)
  expect(conflict.stdout).toBe("")
  expect(conflict.stderr).toBe("--application-id and --clear-application-id are mutually exclusive.\n")
}, 30_000)

test("CLI OIDC system gap commands require a system credential", async () => {
  const result = await cliRunWithEnvironment(
    { AUTHWORKS_REALM_ID: undefined, AUTHWORKS_SYSTEM_SECRET: undefined },
    "oidc",
    "key-ensure-active",
    "--server",
    "http://127.0.0.1:1",
  )
  expect(result.exitCode).not.toBe(0)
  expect(result.stdout).toBe("")
  expect(result.stderr).toContain("system credential")
}, 30_000)

test("CLI OIDC gap round trip succeeds through the composed server", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-oidc-gaps-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "cli-oidc-gaps-secret",
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({ fetch: created.data.fetch, port: 0 })
  try {
    const serverUrl = server.url.toString()
    const realmCreate = await cliRun(
      "realms",
      "create",
      "--server",
      serverUrl,
      "--token",
      "cli-oidc-gaps-secret",
      "--domain",
      "localhost",
      "--name",
      "OIDC gaps realm",
    )
    expect(realmCreate.exitCode).toBe(0)
    const realmId = (JSON.parse(realmCreate.stdout) as { realm: { id: string } }).realm.id

    const discovery = await cliRun("oidc", "discovery-get", "--server", serverUrl)
    expect(discovery.exitCode).toBe(0)
    expect(discovery.stderr).toBe("")
    expect(JSON.parse(discovery.stdout)).toMatchObject({
      authorization_endpoint: expect.stringContaining("/oauth2/authorize"),
    })

    const jwks = await cliRun("oidc", "jwks-get", "--server", serverUrl)
    expect(jwks.exitCode).toBe(0)
    expect(jwks.stderr).toBe("")
    expect(JSON.parse(jwks.stdout)).toMatchObject({ keys: expect.any(Array) })

    const clientCreate = await cliRun(
      "oidc",
      "client-create",
      "--server",
      serverUrl,
      "--system-token",
      "cli-oidc-gaps-secret",
      "--realm-id",
      realmId,
      "--name",
      "Gaps client",
      "--client-type",
      "confidential",
      "--redirect-uris",
      "https://app.example.com/callback",
    )
    expect(clientCreate.exitCode).toBe(0)
    const clientId = (JSON.parse(clientCreate.stdout) as { client: { id: string } }).client.id

    const lifecycle = await cliRun(
      "oidc",
      "client-lifecycle-set",
      "--server",
      serverUrl,
      "--system-token",
      "cli-oidc-gaps-secret",
      "--realm-id",
      realmId,
      "--client-id",
      clientId,
      "--status",
      "inactive",
    )
    expect(lifecycle.exitCode).toBe(0)
    expect(JSON.parse(lifecycle.stdout)).toMatchObject({ client: { id: clientId, status: "inactive" } })

    const ensureActive = await cliRun(
      "oidc",
      "key-ensure-active",
      "--server",
      serverUrl,
      "--system-token",
      "cli-oidc-gaps-secret",
      "--realm-id",
      realmId,
    )
    expect(ensureActive.exitCode).toBe(0)
    expect(JSON.parse(ensureActive.stdout)).toMatchObject({ signingKey: { status: "active" } })
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
}, 60_000)

test("CLI MFA gap round trip succeeds through the composed server", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-mfa-gaps-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "cli-mfa-gaps-secret",
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({ fetch: created.data.fetch, port: 0 })
  try {
    const serverUrl = server.url.toString()
    const realmCreate = await cliRun(
      "realms",
      "create",
      "--server",
      serverUrl,
      "--token",
      "cli-mfa-gaps-secret",
      "--domain",
      "mfa-gaps.example.com",
      "--name",
      "MFA gaps realm",
    )
    expect(realmCreate.exitCode).toBe(0)
    const realmId = (JSON.parse(realmCreate.stdout) as { realm: { id: string } }).realm.id

    const policyGet = await cliRun(
      "mfa",
      "policy",
      "get",
      "--server",
      serverUrl,
      "--system-token",
      "cli-mfa-gaps-secret",
      "--realm-id",
      realmId,
    )
    expect(policyGet.exitCode).toBe(0)
    expect(policyGet.stderr).toBe("")
    expect(JSON.parse(policyGet.stdout)).toMatchObject({ policy: { mode: expect.any(String) } })

    const policySet = await cliRun(
      "mfa",
      "policy",
      "set",
      "--server",
      serverUrl,
      "--system-token",
      "cli-mfa-gaps-secret",
      "--realm-id",
      realmId,
      "--mode",
      "optional",
      "--totp-window",
      "1",
      "--max-attempts",
      "5",
      "--lockout-duration-ms",
      "60000",
    )
    expect(policySet.exitCode).toBe(0)
    expect(JSON.parse(policySet.stdout)).toMatchObject({ policy: { mode: "optional" } })
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
}, 60_000)

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

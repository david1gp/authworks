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

const gapHelpRoutes: Array<{ readonly args: string[]; readonly flag: string }> = [
  { args: ["external-identities", "provider-update"], flag: "--provider-id" },
  { args: ["external-identities", "tenant-provider-create"], flag: "--display-name" },
  { args: ["external-identities", "tenant-provider-list"], flag: "--realm-id" },
  { args: ["external-identities", "tenant-provider-get"], flag: "--provider-id" },
  { args: ["external-identities", "tenant-provider-update"], flag: "--provider-id" },
  { args: ["external-identities", "tenant-provider-disable"], flag: "--provider-id" },
  { args: ["external-identities", "provider-public-list"], flag: "--realm-id" },
  { args: ["external-identities", "provider-me-list"], flag: "--realm-id" },
  { args: ["external-identities", "link-start"], flag: "--user-id" },
  { args: ["external-identities", "link-complete"], flag: "--confirmation-token" },
  { args: ["external-identities", "unlink"], flag: "--external-subject" },
  { args: ["external-identities", "me-list"], flag: "--realm-id" },
  { args: ["external-identities", "me-link-start"], flag: "--provider-id" },
  { args: ["external-identities", "me-link-complete"], flag: "--confirmation-token" },
  { args: ["external-identities", "me-unlink"], flag: "--external-subject" },
  { args: ["passwords", "me-change"], flag: "--new-password" },
  { args: ["passwords", "policy", "system-get"], flag: "--realm-id" },
  { args: ["passwords", "credential-replace"], flag: "--user-id" },
  { args: ["whatsapp-otp", "phone-change-start"], flag: "--phone-number" },
  { args: ["whatsapp-otp", "phone-change-resend"], flag: "--challenge-id" },
  { args: ["whatsapp-otp", "phone-change-verify"], flag: "--phone-number" },
]

test("CLI identity and password gap commands expose help", async () => {
  for (const route of gapHelpRoutes) {
    const result = await cliRun(...route.args, "--help")
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("--realm-id")
    expect(result.stdout).toContain("--profile NAME")
    expect(result.stdout).toContain(route.flag)
  }
}, 30_000)

test("CLI identity and password gap commands require a realm before any request", async () => {
  const unavailableServer = "http://127.0.0.1:1"
  for (const args of [
    ["external-identities", "provider-public-list", "--server", unavailableServer],
    ["external-identities", "provider-me-list", "--server", unavailableServer],
    ["external-identities", "tenant-provider-list", "--server", unavailableServer],
    ["external-identities", "tenant-provider-get", "--server", unavailableServer, "--provider-id", "provider-id"],
    ["external-identities", "me-list", "--server", unavailableServer],
    [
      "external-identities",
      "link-start",
      "--server",
      unavailableServer,
      "--user-id",
      "user-id",
      "--provider-id",
      "provider-id",
    ],
    ["passwords", "policy", "system-get", "--server", unavailableServer],
    ["passwords", "me-change", "--server", unavailableServer, "--new-password", "replacement"],
    [
      "passwords",
      "credential-replace",
      "--server",
      unavailableServer,
      "--user-id",
      "user-id",
      "--password",
      "replacement",
    ],
    ["whatsapp-otp", "phone-change-start", "--server", unavailableServer, "--phone-number", "+15551234567"],
    [
      "whatsapp-otp",
      "phone-change-verify",
      "--server",
      unavailableServer,
      "--challenge-id",
      "challenge-id",
      "--code",
      "123456",
      "--phone-number",
      "+15551234567",
    ],
  ]) {
    const result = await cliRunWithEnvironment({ AUTHWORKS_REALM_ID: undefined }, ...args)
    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).toBe("")
    expect(result.stderr).toBe("Expected input for flag --realm-id\n")
  }
}, 30_000)

test("CLI external identity provider update and public list succeed through the composed server", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-identity-gaps-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "cli-identity-gaps-secret",
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({ fetch: created.data.fetch, port: 0 })
  const serverUrl = server.url.toString().replace("localhost", "127.0.0.1")
  try {
    const realmCreate = await cliRun(
      "realms",
      "create",
      "--server",
      serverUrl,
      "--token",
      "cli-identity-gaps-secret",
      "--domain",
      "127.0.0.1",
      "--name",
      "Identity gaps realm",
    )
    expect(realmCreate.exitCode).toBe(0)
    const realmId = (JSON.parse(realmCreate.stdout) as { realm: { id: string } }).realm.id

    const providerCreate = await cliRun(
      "external-identities",
      "provider-create",
      "--server",
      serverUrl,
      "--system-token",
      "cli-identity-gaps-secret",
      "--realm-id",
      realmId,
      "--type",
      "google",
      "--client-id",
      "gaps-client",
      "--client-secret",
      "gaps-secret",
      "--display-name",
      "Gaps provider",
      "--redirect-uri",
      "https://gaps.example.com/callback",
    )
    expect(providerCreate.exitCode).toBe(0)
    const providerId = (JSON.parse(providerCreate.stdout) as { provider: { id: string } }).provider.id

    const providerUpdate = await cliRun(
      "external-identities",
      "provider-update",
      "--server",
      serverUrl,
      "--system-token",
      "cli-identity-gaps-secret",
      "--realm-id",
      realmId,
      "--provider-id",
      providerId,
      "--display-name",
      "Gaps provider renamed",
    )
    expect(providerUpdate.exitCode).toBe(0)
    expect(providerUpdate.stderr).toBe("")
    expect(JSON.parse(providerUpdate.stdout)).toMatchObject({
      provider: { displayName: "Gaps provider renamed", id: providerId },
    })

    const publicList = await cliRun(
      "external-identities",
      "provider-public-list",
      "--server",
      serverUrl,
      "--realm-id",
      realmId,
    )
    expect(publicList.exitCode).toBe(0)
    expect(publicList.stderr).toBe("")
    expect(JSON.parse(publicList.stdout)).toMatchObject({ items: [{ id: providerId }] })

    const linkStart = await cliRun(
      "external-identities",
      "link-start",
      "--server",
      serverUrl,
      "--system-token",
      "cli-identity-gaps-secret",
      "--realm-id",
      realmId,
      "--user-id",
      "00000000-0000-4000-8000-000000000000",
      "--provider-id",
      providerId,
    )
    expect(linkStart.exitCode).not.toBe(0)
    expect(linkStart.stdout).toBe("")
    expect(linkStart.stderr.length).toBeGreaterThan(0)
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
}, 30_000)

test("CLI password policy system-get succeeds through the composed server", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-password-gaps-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "cli-password-gaps-secret",
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({ fetch: created.data.fetch, port: 0 })
  const serverUrl = server.url.toString().replace("localhost", "127.0.0.1")
  try {
    const realmCreate = await cliRun(
      "realms",
      "create",
      "--server",
      serverUrl,
      "--token",
      "cli-password-gaps-secret",
      "--domain",
      "password-gaps.example.com",
      "--name",
      "Password gaps realm",
    )
    expect(realmCreate.exitCode).toBe(0)
    const realmId = (JSON.parse(realmCreate.stdout) as { realm: { id: string } }).realm.id

    const systemGet = await cliRun(
      "passwords",
      "policy",
      "system-get",
      "--server",
      serverUrl,
      "--system-token",
      "cli-password-gaps-secret",
      "--realm-id",
      realmId,
    )
    expect(systemGet.exitCode).toBe(0)
    expect(systemGet.stderr).toBe("")
    const policy = (JSON.parse(systemGet.stdout) as { policy: { minimumLength: number } }).policy
    expect(policy.minimumLength).toBeGreaterThan(0)
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
}, 30_000)

test("CLI WhatsApp OTP availability succeeds and phone-change reaches the composed server", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-whatsapp-gaps-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "cli-whatsapp-gaps-secret",
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({ fetch: created.data.fetch, port: 0 })
  const serverUrl = server.url.toString().replace("localhost", "127.0.0.1")
  try {
    const realmCreate = await cliRun(
      "realms",
      "create",
      "--server",
      serverUrl,
      "--token",
      "cli-whatsapp-gaps-secret",
      "--domain",
      "127.0.0.1",
      "--name",
      "WhatsApp gaps realm",
    )
    expect(realmCreate.exitCode).toBe(0)
    const realmId = (JSON.parse(realmCreate.stdout) as { realm: { id: string } }).realm.id

    const availability = await cliRun("whatsapp-otp", "availability", "--server", serverUrl, "--realm-id", realmId)
    expect(availability.exitCode).toBe(0)
    expect(availability.stderr).toBe("")
    expect(JSON.parse(availability.stdout)).toMatchObject({ available: false })

    const phoneChangeStart = await cliRun(
      "whatsapp-otp",
      "phone-change-start",
      "--server",
      serverUrl,
      "--realm-id",
      realmId,
      "--phone-number",
      "+15551234567",
    )
    expect(phoneChangeStart.exitCode).not.toBe(0)
    expect(phoneChangeStart.stdout).toBe("")
    expect(phoneChangeStart.stderr.length).toBeGreaterThan(0)
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

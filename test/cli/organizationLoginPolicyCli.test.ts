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

test("CLI executes realm and organization login-policy administration safely", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-organization-login-policy-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "organization-policy-secret",
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({ fetch: created.data.fetch, port: 0 })

  try {
    const realm = await cliRun(
      "realms",
      "create",
      "--server",
      server.url.toString(),
      "--token",
      "organization-policy-secret",
      "--domain",
      "organization-policy.example.com",
      "--name",
      "Organization policy realm",
    )
    expect(realm.exitCode).toBe(0)
    const realmId = (JSON.parse(realm.stdout) as { realm: { id: string } }).realm.id

    const organization = await cliRun(
      "organizations",
      "create",
      "--server",
      server.url.toString(),
      "--token",
      "organization-policy-secret",
      "--realm-id",
      realmId,
      "--name",
      "Organization policy organization",
    )
    expect(organization.exitCode).toBe(0)
    const organizationId = (JSON.parse(organization.stdout) as { organization: { id: string } }).organization.id

    const realmSet = await cliRun(
      "organizations",
      "realm-login-policy-set",
      "--server",
      server.url.toString(),
      "--token",
      "organization-policy-secret",
      "--realm-id",
      realmId,
      "--policy",
      JSON.stringify({
        allowedFactors: ["totp", "passkey"],
        minimumStepUpAssurance: "multi_factor",
        preferredFactorOrder: ["passkey", "totp"],
        requiredMfa: true,
      }),
    )
    expect(realmSet.exitCode).toBe(0)
    expect(JSON.parse(realmSet.stdout)).toMatchObject({
      policy: {
        allowedFactors: ["totp", "passkey"],
        minimumStepUpAssurance: "multi_factor",
        preferredFactorOrder: ["passkey", "totp"],
        requiredMfa: true,
      },
    })

    const realmGet = await cliRun(
      "organizations",
      "realm-login-policy-get",
      "--server",
      server.url.toString(),
      "--token",
      "organization-policy-secret",
      "--realm-id",
      realmId,
    )
    expect(realmGet.exitCode).toBe(0)
    expect(JSON.parse(realmGet.stdout)).toMatchObject({
      overrides: {
        allowedFactors: ["totp", "passkey"],
        minimumStepUpAssurance: "multi_factor",
        preferredFactorOrder: ["passkey", "totp"],
        requiredMfa: true,
      },
    })

    const organizationSet = await cliRun(
      "organizations",
      "login-policy-set",
      "--server",
      server.url.toString(),
      "--token",
      "organization-policy-secret",
      "--realm-id",
      realmId,
      "--organization-id",
      organizationId,
      "--policy",
      JSON.stringify({
        allowedFactors: ["totp"],
        minimumStepUpAssurance: "multi_factor",
        preferredFactorOrder: ["totp"],
        requiredMfa: true,
      }),
    )
    expect(organizationSet.exitCode).toBe(0)

    const organizationGet = await cliRun(
      "organizations",
      "login-policy-get",
      "--server",
      server.url.toString(),
      "--token",
      "organization-policy-secret",
      "--realm-id",
      realmId,
      "--organization-id",
      organizationId,
    )
    expect(organizationGet.exitCode).toBe(0)
    expect(JSON.parse(organizationGet.stdout)).toMatchObject({
      overrides: {
        allowedFactors: ["totp"],
        minimumStepUpAssurance: "multi_factor",
        preferredFactorOrder: ["totp"],
        requiredMfa: true,
      },
      policy: {
        allowedFactors: ["totp"],
        minimumStepUpAssurance: "multi_factor",
        preferredFactorOrder: ["totp"],
        requiredMfa: true,
      },
    })

    const inherited = await cliRun(
      "organizations",
      "login-policy-set",
      "--server",
      server.url.toString(),
      "--token",
      "organization-policy-secret",
      "--realm-id",
      realmId,
      "--organization-id",
      organizationId,
      "--policy",
      JSON.stringify({
        allowedFactors: null,
        minimumStepUpAssurance: null,
        preferredFactorOrder: null,
        requiredMfa: null,
      }),
    )
    expect(inherited.exitCode).toBe(0)
    expect(JSON.parse(inherited.stdout)).toMatchObject({
      overrides: {},
      policy: {
        allowedFactors: ["totp", "passkey"],
        minimumStepUpAssurance: "multi_factor",
        preferredFactorOrder: ["passkey", "totp"],
        requiredMfa: true,
      },
    })

    const malformed = await cliRun(
      "organizations",
      "realm-login-policy-set",
      "--server",
      server.url.toString(),
      "--token",
      "organization-policy-secret",
      "--realm-id",
      realmId,
      "--policy",
      "{",
    )
    expect(malformed.exitCode).not.toBe(0)
    expect(JSON.parse(malformed.stderr)).toMatchObject({ error: { code: "organizations.invalid" } })

    const invalid = await cliRun(
      "organizations",
      "login-policy-set",
      "--server",
      server.url.toString(),
      "--token",
      "organization-policy-secret",
      "--realm-id",
      realmId,
      "--organization-id",
      organizationId,
      "--policy",
      JSON.stringify({ allowedFactors: ["recovery_code"] }),
    )
    expect(invalid.exitCode).not.toBe(0)
    expect(JSON.parse(invalid.stderr)).toMatchObject({ error: { code: "organizations.invalid" } })

    const unauthorized = await cliRun(
      "organizations",
      "realm-login-policy-get",
      "--server",
      server.url.toString(),
      "--token",
      "wrong-token",
      "--realm-id",
      realmId,
    )
    expect(unauthorized.exitCode).not.toBe(0)
    expect(JSON.parse(unauthorized.stderr)).toMatchObject({ error: { status: 401 } })

    const secondRealm = await cliRun(
      "realms",
      "create",
      "--server",
      server.url.toString(),
      "--token",
      "organization-policy-secret",
      "--domain",
      "organization-policy-second.example.com",
      "--name",
      "Second organization policy realm",
    )
    expect(secondRealm.exitCode).toBe(0)
    const secondRealmId = (JSON.parse(secondRealm.stdout) as { realm: { id: string } }).realm.id
    const crossTenant = await cliRun(
      "organizations",
      "login-policy-get",
      "--server",
      server.url.toString(),
      "--token",
      "organization-policy-secret",
      "--realm-id",
      secondRealmId,
      "--organization-id",
      organizationId,
    )
    expect(crossTenant.exitCode).not.toBe(0)
    expect(JSON.parse(crossTenant.stderr)).toMatchObject({ error: { code: "organizations.not-found" } })

    const organizationRequired = await cliRun(
      "organizations",
      "login-policy-set",
      "--server",
      server.url.toString(),
      "--token",
      "organization-policy-secret",
      "--realm-id",
      realmId,
      "--organization-id",
      organizationId,
      "--policy",
      JSON.stringify({
        allowedFactors: ["totp"],
        minimumStepUpAssurance: "multi_factor",
        preferredFactorOrder: ["totp"],
        requiredMfa: true,
      }),
    )
    expect(organizationRequired.exitCode).toBe(0)

    const rollback = await cliRun(
      "organizations",
      "realm-login-policy-set",
      "--server",
      server.url.toString(),
      "--token",
      "organization-policy-secret",
      "--realm-id",
      realmId,
      "--policy",
      JSON.stringify({ allowedFactors: ["passkey"] }),
    )
    expect(rollback.exitCode).not.toBe(0)
    expect(JSON.parse(rollback.stderr)).toMatchObject({ error: { code: "organizations.invalid" } })

    const afterRollback = await cliRun(
      "organizations",
      "realm-login-policy-get",
      "--server",
      server.url.toString(),
      "--token",
      "organization-policy-secret",
      "--realm-id",
      realmId,
    )
    expect(afterRollback.exitCode).toBe(0)
    expect(JSON.parse(afterRollback.stdout)).toMatchObject({
      overrides: { allowedFactors: ["totp", "passkey"] },
      policy: { allowedFactors: ["totp", "passkey"] },
    })
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

async function cliRun(...args: string[]): Promise<CliRun> {
  const child = Bun.spawn(["bun", "src/outputs/cli.ts", ...args], {
    env: process.env,
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

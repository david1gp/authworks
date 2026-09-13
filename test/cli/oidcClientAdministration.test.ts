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

type ClientOutput = {
  readonly client: {
    readonly accessTokenRoleAssertion: boolean
    readonly additionalOrigins: string[]
    readonly id: string
    readonly idTokenUserinfoAssertion: boolean
  }
}

test("OIDC client administration help exposes compatibility flags and negated booleans", async () => {
  const create = await cliRun("oidc", "client-create", "--help")
  expect(create.exitCode).toBe(0)
  expect(create.stderr).toBe("")
  expect(create.stdout).toContain("--access-token-role-assertion/--no-access-token-role-assertion")
  expect(create.stdout).toContain("--id-token-userinfo-assertion/--no-id-token-userinfo-assertion")
  expect(create.stdout).toContain("--additional-origins")

  const update = await cliRun("oidc", "client-update", "--help")
  expect(update.exitCode).toBe(0)
  expect(update.stderr).toBe("")
  expect(update.stdout).toContain("--client-id UUID")
  expect(update.stdout).toContain("--access-token-role-assertion/--no-access-token-role-assertion")
  expect(update.stdout).toContain("--id-token-userinfo-assertion/--no-id-token-userinfo-assertion")
  expect(update.stdout).toContain("--additional-origins")
})

test("OIDC client compatibility settings parse, round trip through create/update/get, and preserve omitted values", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-client-administration-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "oidc-client-administration-secret",
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
      "oidc-client-administration-secret",
      "--domain",
      "oidc-client-administration.example.com",
      "--name",
      "OIDC client administration realm",
    )
    expect(realm.exitCode).toBe(0)
    const realmId = (JSON.parse(realm.stdout) as { readonly realm: { readonly id: string } }).realm.id

    const clientCreate = await cliRun(
      "oidc",
      "client-create",
      "--server",
      server.url.toString(),
      "--token",
      "oidc-client-administration-secret",
      "--realm-id",
      realmId,
      "--name",
      "Compatibility client",
      "--client-type",
      "public",
      "--redirect-uris",
      "https://client.example.com/callback",
      "--access-token-role-assertion",
      "--id-token-userinfo-assertion",
      "--additional-origins",
      "https://client.example.com, https://admin.example.com",
    )
    expect(clientCreate.exitCode).toBe(0)
    expect(clientCreate.stderr).toBe("")
    const createdClient = JSON.parse(clientCreate.stdout) as ClientOutput
    expect(createdClient.client).toMatchObject({
      accessTokenRoleAssertion: true,
      additionalOrigins: ["https://client.example.com", "https://admin.example.com"],
      idTokenUserinfoAssertion: true,
    })

    const cleared = await cliRun(
      "oidc",
      "client-update",
      "--server",
      server.url.toString(),
      "--token",
      "oidc-client-administration-secret",
      "--realm-id",
      realmId,
      "--client-id",
      createdClient.client.id,
      "--no-access-token-role-assertion",
      "--no-id-token-userinfo-assertion",
      "--additional-origins",
      "",
    )
    expect(cleared.exitCode).toBe(0)
    expect(cleared.stderr).toBe("")
    expect(JSON.parse(cleared.stdout)).toMatchObject({
      client: {
        accessTokenRoleAssertion: false,
        additionalOrigins: [],
        idTokenUserinfoAssertion: false,
      },
    })

    const renamed = await cliRun(
      "oidc",
      "client-update",
      "--server",
      server.url.toString(),
      "--token",
      "oidc-client-administration-secret",
      "--realm-id",
      realmId,
      "--client-id",
      createdClient.client.id,
      "--name",
      "Compatibility client renamed",
    )
    expect(renamed.exitCode).toBe(0)
    expect(JSON.parse(renamed.stdout)).toMatchObject({
      client: {
        accessTokenRoleAssertion: false,
        additionalOrigins: [],
        idTokenUserinfoAssertion: false,
      },
    })

    const read = await cliRun(
      "oidc",
      "client-get",
      "--server",
      server.url.toString(),
      "--token",
      "oidc-client-administration-secret",
      "--realm-id",
      realmId,
      "--client-id",
      createdClient.client.id,
    )
    expect(read.exitCode).toBe(0)
    expect(read.stderr).toBe("")
    expect(JSON.parse(read.stdout)).toMatchObject({
      client: {
        accessTokenRoleAssertion: false,
        additionalOrigins: [],
        idTokenUserinfoAssertion: false,
        name: "Compatibility client renamed",
      },
    })
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

test("OIDC client administration redacts connection tokens from subprocess errors", async () => {
  const token = "oidc-client-administration-redaction-token"
  const server = Bun.serve({
    fetch(request) {
      const authorization = request.headers.get("authorization") ?? "missing authorization"
      return Response.json(
        {
          error: {
            code: "platform.test",
            message: `The request failed for ${authorization} and ${token}.`,
            status: 500,
          },
        },
        { status: 500 },
      )
    },
    port: 0,
  })

  try {
    const result = await cliRun(
      "oidc",
      "client-update",
      "--server",
      server.url.toString(),
      "--token",
      token,
      "--realm-id",
      "realm-id",
      "--client-id",
      "client-id",
      "--name",
      "Redaction test",
    )
    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).toBe("")
    expect(result.stderr).not.toContain(token)
    expect(result.stderr).toContain("[REDACTED]")
  } finally {
    server.stop(true)
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

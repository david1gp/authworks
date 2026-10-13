import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { connectionProfilesStoreCreate } from "../../src/features/connectionProfiles/persistence/connectionProfilesStoreCreate.js"

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
  expect(create.stdout).toContain("requires system authorization")
  expect(create.stdout).toContain("--token")
  expect(create.stdout).toContain("not valid for system endpoints")
  expect(create.stdout).toContain("--system-token")
  expect(create.stdout).toContain("AUTHWORKS_SYSTEM_SECRET")

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
      "--system-token",
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
      "--system-token",
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
      "--system-token",
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
      "--system-token",
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
  const systemToken = "oidc-client-administration-redaction-system-token"
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
      "--system-token",
      systemToken,
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
    expect(result.stderr).not.toContain(systemToken)
    expect(result.stderr).toContain("[REDACTED]")
  } finally {
    server.stop(true)
  }
})

test("OIDC system commands reject missing system credentials before API I/O", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-system-token-required-"))
  const configHome = join(directory, "config")
  let requests = 0
  const server = Bun.serve({
    fetch() {
      requests += 1
      return Response.json({ items: [] })
    },
    port: 0,
  })

  try {
    const profile = await connectionProfilesStoreCreate({
      environment: { XDG_CONFIG_HOME: configHome },
    }).connectionProfileSet("user-session", {
      server: server.url.toString(),
      token: "saved-user-profile-token",
    })
    expect(profile.success).toBe(true)

    const missing = await cliRunWithEnvironment(
      { AUTHWORKS_SYSTEM_SECRET: undefined, AUTHWORKS_TOKEN: undefined, XDG_CONFIG_HOME: configHome },
      "oidc",
      "client-list",
      "--server",
      server.url.toString(),
      "--realm-id",
      "realm-id",
    )
    const explicitUserToken = await cliRunWithEnvironment(
      { AUTHWORKS_SYSTEM_SECRET: undefined, AUTHWORKS_TOKEN: undefined, XDG_CONFIG_HOME: configHome },
      "oidc",
      "client-list",
      "--server",
      server.url.toString(),
      "--realm-id",
      "realm-id",
      "--token",
      "user-session-token",
    )
    const savedUserToken = await cliRunWithEnvironment(
      { AUTHWORKS_SYSTEM_SECRET: undefined, AUTHWORKS_TOKEN: undefined, XDG_CONFIG_HOME: configHome },
      "oidc",
      "client-list",
      "--profile",
      "user-session",
      "--realm-id",
      "realm-id",
    )

    for (const result of [missing, explicitUserToken, savedUserToken]) {
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toBe("")
      expect(result.stderr).toContain("--system-token")
      expect(result.stderr).toContain("AUTHWORKS_SYSTEM_SECRET")
      expect(result.stderr).toContain("--token is a user session")
      expect(result.stderr).toContain("browser realm-owner/admin UI")
      expect(result.stderr).toContain("fixed-purpose ensure command")
      expect(result.stderr).not.toContain("saved-user-profile-token")
    }
    expect(requests).toBe(0)
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

test("OIDC system commands accept explicit and environment credentials, with the explicit flag taking precedence", async () => {
  const authorizations: Array<string | undefined> = []
  const server = Bun.serve({
    fetch(request) {
      authorizations.push(request.headers.get("authorization") ?? undefined)
      return Response.json({ items: [] })
    },
    port: 0,
  })

  try {
    const environmentCredential = await cliRunWithEnvironment(
      { AUTHWORKS_SYSTEM_SECRET: "environment-system-credential" },
      "oidc",
      "client-list",
      "--server",
      server.url.toString(),
      "--realm-id",
      "realm-id",
      "--token",
      "user-session-token",
    )
    const explicitCredential = await cliRunWithEnvironment(
      { AUTHWORKS_SYSTEM_SECRET: "environment-system-credential" },
      "oidc",
      "client-list",
      "--server",
      server.url.toString(),
      "--realm-id",
      "realm-id",
      "--token",
      "user-session-token",
      "--system-token",
      "explicit-system-credential",
    )

    expect(environmentCredential.exitCode).toBe(0)
    expect(explicitCredential.exitCode).toBe(0)
    expect(authorizations).toEqual(["Bearer environment-system-credential", "Bearer explicit-system-credential"])
    expect(environmentCredential.stdout).not.toContain("environment-system-credential")
    expect(explicitCredential.stdout).not.toContain("explicit-system-credential")
  } finally {
    server.stop(true)
  }
})

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

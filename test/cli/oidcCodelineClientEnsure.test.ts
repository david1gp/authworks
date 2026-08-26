import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { oidcApiClientCreate } from "../../src/features/oidc/client/oidcApiClientCreate.js"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"

type CliRun = {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}

test("Codeline client ensure creates, updates, and never prints the client secret", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-codeline-client-ensure-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "codeline-client-ensure-secret",
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({ fetch: created.data.fetch, port: 0 })
  const envFile = join(directory, ".env")
  await writeFile(envFile, "# preserved\nZITADEL_CLIENT_ID=legacy-client-id\nOTHER=value\n", { mode: 0o600 })

  try {
    const realm = await cliRun(
      {
        AUTHWORKS_SYSTEM_SECRET: "codeline-client-ensure-secret",
      },
      "realms",
      "create",
      "--server",
      server.url.toString(),
      "--domain",
      "codeline-client-ensure.example.com",
      "--name",
      "Codeline ensure realm",
    )
    expect(realm.exitCode).toBe(0)
    const realmId = (JSON.parse(realm.stdout) as { readonly realm: { readonly id: string } }).realm.id

    const first = await cliRun(
      { AUTHWORKS_SYSTEM_SECRET: "codeline-client-ensure-secret" },
      "oidc",
      "client-ensure",
      "--server",
      server.url.toString(),
      "--realm-id",
      realmId,
      "--env-file",
      envFile,
    )
    expect(first.exitCode).toBe(0)
    expect(first.stderr).toBe("")
    const firstOutput = JSON.parse(first.stdout) as {
      readonly action: string
      readonly client: { readonly id: string }
    }
    expect(firstOutput.action).toBe("created")
    const environmentAfterCreate = await readFile(envFile, "utf8")
    const clientSecret = environmentValueGet(environmentAfterCreate, "OIDC_CLIENT_SECRET")
    expect(clientSecret).toBeDefined()
    expect(first.stdout).not.toContain(clientSecret ?? "")
    expect(environmentAfterCreate).toContain(`OIDC_CLIENT_ID=${firstOutput.client.id}`)
    expect(environmentAfterCreate).toContain(`OIDC_AUTHWORKS_CLIENT_ID=${firstOutput.client.id}`)
    expect(environmentAfterCreate).toContain(`OIDC_AUTHWORKS_CLIENT_SECRET=${clientSecret}`)
    expect(environmentAfterCreate).toContain(`ZITADEL_CLIENT_ID=${firstOutput.client.id}`)
    expect(environmentAfterCreate).toContain(`ZITADEL_CLIENT_SECRET=${clientSecret}`)
    expect(environmentAfterCreate).toContain("OTHER=value")

    const second = await cliRun(
      { AUTHWORKS_SYSTEM_SECRET: "codeline-client-ensure-secret" },
      "oidc",
      "client-ensure",
      "--server",
      server.url.toString(),
      "--realm-id",
      realmId,
      "--env-file",
      envFile,
    )
    expect(second.exitCode).toBe(0)
    expect(second.stderr).toBe("")
    expect((JSON.parse(second.stdout) as { readonly action: string }).action).toBe("unchanged")
    expect(second.stdout).not.toContain(clientSecret ?? "")

    const api = oidcApiClientCreate({ baseUrl: server.url.toString(), token: "codeline-client-ensure-secret" })
    const drifted = await api.oidcClientUpdate(realmId, firstOutput.client.id, {
      allowedScopes: ["openid"],
      redirectUris: ["https://wrong.example.com/callback"],
      requireConsent: true,
      trusted: false,
    })
    expect(drifted.success).toBe(true)

    const third = await cliRun(
      { AUTHWORKS_SYSTEM_SECRET: "codeline-client-ensure-secret" },
      "oidc",
      "client-ensure",
      "--server",
      server.url.toString(),
      "--realm-id",
      realmId,
      "--env-file",
      envFile,
    )
    expect(third.exitCode).toBe(0)
    expect(third.stderr).toBe("")
    expect((JSON.parse(third.stdout) as { readonly action: string }).action).toBe("updated")
    expect(third.stdout).not.toContain(clientSecret ?? "")
    expect(third.stdout).toContain("urn:zitadel:iam:user:resourceowner")
    expect(third.stdout).toContain("https://preview.codeline.work/api/auth/callback")
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

async function cliRun(environmentOverrides: Record<string, string>, ...args: string[]): Promise<CliRun> {
  const child = Bun.spawn(["bun", "src/outputs/cli.ts", ...args], {
    env: { ...process.env, ...environmentOverrides },
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

function environmentValueGet(content: string, name: string): string | undefined {
  const match = new RegExp(`^${name}=(.*)$`, "m").exec(content)
  return match?.[1]
}

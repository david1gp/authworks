import { Database } from "bun:sqlite"
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

const numericProjectId = "381760977282007057"

test("OIDC client project flags link numeric projects, clear, and reject conflicting flags", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-client-project-id-cli-"))
  const databasePath = join(directory, "authworks.sqlite")
  const created = serverApplicationCreate({
    databasePath,
    systemSecret: "oidc-client-project-id-cli-secret",
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({ fetch: created.data.fetch, port: 0 })

  try {
    const baseArgs = ["--server", server.url.toString()] as const
    const adminArgs = [...baseArgs, "--token", "oidc-client-project-id-cli-secret"] as const
    const oidcArgs = [...baseArgs, "--system-token", "oidc-client-project-id-cli-secret"] as const
    const realm = await cliRun(
      "realms",
      "create",
      ...adminArgs,
      "--domain",
      "oidc-project-id-cli.example.com",
      "--name",
      "OIDC project ID CLI realm",
    )
    expect(realm.exitCode).toBe(0)
    if (realm.exitCode !== 0) throw new Error(realm.stderr)
    const realmId = (JSON.parse(realm.stdout) as { readonly realm: { readonly id: string } }).realm.id

    const organization = await cliRun(
      "organizations",
      "create",
      ...adminArgs,
      "--realm-id",
      realmId,
      "--name",
      "Project ID CLI org",
    )
    expect(organization.exitCode).toBe(0)
    if (organization.exitCode !== 0) throw new Error(organization.stderr)
    const organizationId = (JSON.parse(organization.stdout) as { readonly organization: { readonly id: string } })
      .organization.id

    const project = await cliRun(
      "projects",
      "create",
      ...adminArgs,
      "--realm-id",
      realmId,
      "--organization-id",
      organizationId,
      "--name",
      "Migrated numeric CLI project",
    )
    expect(project.exitCode).toBe(0)
    if (project.exitCode !== 0) throw new Error(project.stderr)
    const createdProjectId = (JSON.parse(project.stdout) as { readonly project: { readonly id: string } }).project.id

    const renamer = new Database(databasePath)
    try {
      renamer.run("UPDATE projects SET id = ? WHERE id = ?", [numericProjectId, createdProjectId])
    } finally {
      renamer.close()
    }

    const linked = await cliRun(
      "oidc",
      "client-create",
      ...oidcArgs,
      "--realm-id",
      realmId,
      "--name",
      "Numeric project CLI client",
      "--client-type",
      "public",
      "--redirect-uris",
      "https://client.example.com/callback",
      "--project-id",
      numericProjectId,
    )
    expect(linked.exitCode).toBe(0)
    if (linked.exitCode !== 0) throw new Error(linked.stderr)
    const clientId = (JSON.parse(linked.stdout) as { readonly client: { readonly id: string } }).client.id
    expect(JSON.parse(linked.stdout)).toMatchObject({ client: { projectId: numericProjectId } })

    const conflict = await cliRun(
      "oidc",
      "client-update",
      ...oidcArgs,
      "--realm-id",
      realmId,
      "--client-id",
      clientId,
      "--project-id",
      numericProjectId,
      "--clear-project-id",
    )
    expect(conflict.exitCode).not.toBe(0)
    expect(conflict.stdout).toBe("")
    expect(conflict.stderr).toContain("--project-id and --clear-project-id are mutually exclusive.")

    const cleared = await cliRun(
      "oidc",
      "client-update",
      ...oidcArgs,
      "--realm-id",
      realmId,
      "--client-id",
      clientId,
      "--clear-project-id",
    )
    expect(cleared.exitCode).toBe(0)
    if (cleared.exitCode !== 0) throw new Error(cleared.stderr)
    expect(JSON.parse(cleared.stdout)).not.toMatchObject({ client: { projectId: numericProjectId } })

    const relinked = await cliRun(
      "oidc",
      "client-update",
      ...oidcArgs,
      "--realm-id",
      realmId,
      "--client-id",
      clientId,
      "--project-id",
      numericProjectId,
    )
    expect(relinked.exitCode).toBe(0)
    if (relinked.exitCode !== 0) throw new Error(relinked.stderr)
    expect(JSON.parse(relinked.stdout)).toMatchObject({ client: { projectId: numericProjectId } })

    const read = await cliRun("oidc", "client-get", ...oidcArgs, "--realm-id", realmId, "--client-id", clientId)
    expect(read.exitCode).toBe(0)
    expect(JSON.parse(read.stdout)).toMatchObject({ client: { projectId: numericProjectId } })

    const help = await cliRun("oidc", "client-update", "--help")
    expect(help.exitCode).toBe(0)
    expect(help.stdout).toContain("--project-id")
    expect(help.stdout).toContain("--clear-project-id")
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

async function cliRun(...args: string[]): Promise<CliRun> {
  const child = Bun.spawn(["bun", "src/outputs/cli.ts", ...args], {
    env: { ...process.env },
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

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

test("CLI project and machine gap commands expose help", async () => {
  const projects = await cliRun("projects", "--help")
  expect(projects.exitCode).toBe(0)
  expect(projects.stderr).toBe("")
  for (const route of [
    "access-check",
    "application-delete",
    "application-get",
    "application-lifecycle",
    "application-update",
    "delete",
    "grant-delete",
    "grant-lifecycle",
    "grant-update",
    "role-delete",
    "role-update",
  ]) {
    expect(projects.stdout).toContain(route)
  }

  const machines = await cliRun("machine-users", "--help")
  expect(machines.exitCode).toBe(0)
  expect(machines.stderr).toBe("")
  expect(machines.stdout).toContain("credential-issue")
  expect(machines.stdout).toContain("protected-api-get")

  const applicationGet = await cliRun("projects", "application-get", "--help")
  expect(applicationGet.stdout).toContain("--application-id")

  const grantUpdate = await cliRun("projects", "grant-update", "--help")
  expect(grantUpdate.stdout).toContain("--grant-id")

  const roleUpdate = await cliRun("projects", "role-update", "--help")
  expect(roleUpdate.stdout).toContain("--role-id")

  const credentialIssue = await cliRun("machine-users", "credential-issue", "--help")
  expect(credentialIssue.stdout).toContain("--machine-user-id")

  const protectedApi = await cliRun("machine-users", "protected-api-get", "--help")
  expect(protectedApi.stdout).toContain("--realm-id UUID")
}, 30_000)

test("CLI project and machine gap commands require scope before any request", async () => {
  const unavailableServer = "http://127.0.0.1:1"
  const cleanEnvironment = {
    AUTHWORKS_ORGANIZATION_ID: undefined,
    AUTHWORKS_PROJECT: undefined,
    AUTHWORKS_PROJECT_ID: undefined,
    AUTHWORKS_REALM_ID: undefined,
  }
  for (const [args, expected] of [
    [
      ["projects", "delete", "--server", unavailableServer],
      "Expected input for flag --realm-id\nExpected input for flag --project-id\n",
    ],
    [
      ["projects", "access-check", "--server", unavailableServer],
      "Expected input for flag --realm-id\nExpected input for flag --project-id\n",
    ],
    [
      [
        "machine-users",
        "credential-issue",
        "--server",
        unavailableServer,
        "--machine-user-id",
        "33333333-3333-3333-3333-333333333333",
        "--name",
        "gap-guard-credential",
      ],
      "Expected input for flag --realm-id\nExpected input for flag --organization-id\n",
    ],
    [["machine-users", "protected-api-get", "--server", unavailableServer], "Expected input for flag --realm-id\n"],
  ] as const) {
    const result = await cliRunWithEnvironment(cleanEnvironment, ...args)
    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).toBe("")
    expect(result.stderr).toBe(expected)
  }

  const realmId = "11111111-1111-1111-1111-111111111111"
  const projectId = "22222222-2222-2222-2222-222222222222"
  for (const [args, expected] of [
    [
      ["projects", "application-get", "--server", unavailableServer, "--realm-id", realmId],
      "Expected input for flag --project-id\nExpected input for flag --application-id\n",
    ],
    [
      ["projects", "application-get", "--server", unavailableServer, "--realm-id", realmId, "--project-id", projectId],
      "Expected input for flag --application-id\n",
    ],
    [
      ["projects", "grant-update", "--server", unavailableServer, "--realm-id", realmId],
      "Expected input for flag --project-id\nExpected input for flag --grant-id\n",
    ],
    [
      ["projects", "role-delete", "--server", unavailableServer, "--realm-id", realmId],
      "Expected input for flag --project-id\nExpected input for flag --role-id\n",
    ],
  ] as const) {
    const result = await cliRunWithEnvironment(cleanEnvironment, ...args)
    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).toBe("")
    expect(result.stderr).toBe(expected)
  }
}, 30_000)

test("CLI project gap commands round-trip through the composed server", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-project-gaps-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "cli-project-gaps-secret",
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({ fetch: created.data.fetch, port: 0 })
  const connection = ["--server", server.url.toString(), "--token", "cli-project-gaps-secret"]

  try {
    const realmCreate = await cliRun(
      "realms",
      "create",
      ...connection,
      "--domain",
      "project-gaps.example.com",
      "--name",
      "Project gaps realm",
    )
    expect(realmCreate.exitCode).toBe(0)
    const realmId = (JSON.parse(realmCreate.stdout) as { realm: { id: string } }).realm.id

    const organizationCreate = await cliRun(
      "organizations",
      "create",
      ...connection,
      "--realm-id",
      realmId,
      "--name",
      "Project gaps organization",
    )
    expect(organizationCreate.exitCode).toBe(0)
    const organizationId = (JSON.parse(organizationCreate.stdout) as { organization: { id: string } }).organization.id

    const grantedOrganizationCreate = await cliRun(
      "organizations",
      "create",
      ...connection,
      "--realm-id",
      realmId,
      "--name",
      "Project gaps granted organization",
    )
    expect(grantedOrganizationCreate.exitCode).toBe(0)
    const grantedOrganizationId = (JSON.parse(grantedOrganizationCreate.stdout) as { organization: { id: string } })
      .organization.id

    const projectCreate = await cliRun(
      "projects",
      "create",
      ...connection,
      "--realm-id",
      realmId,
      "--organization-id",
      organizationId,
      "--name",
      "Project gaps project",
    )
    expect(projectCreate.exitCode).toBe(0)
    const projectId = (JSON.parse(projectCreate.stdout) as { project: { id: string } }).project.id
    const scoped = [...connection, "--realm-id", realmId, "--project-id", projectId]

    const applicationCreate = await cliRun(
      "projects",
      "application-create",
      ...scoped,
      "--name",
      "Gaps application",
      "--application-type",
      "oidc",
    )
    expect(applicationCreate.exitCode).toBe(0)
    const applicationId = (JSON.parse(applicationCreate.stdout) as { application: { id: string } }).application.id

    const applicationGet = await cliRun("projects", "application-get", ...scoped, "--application-id", applicationId)
    expect(applicationGet.exitCode).toBe(0)
    expect(JSON.parse(applicationGet.stdout)).toMatchObject({
      application: { id: applicationId, name: "Gaps application" },
    })

    const applicationUpdate = await cliRun(
      "projects",
      "application-update",
      ...scoped,
      "--application-id",
      applicationId,
      "--name",
      "Gaps application renamed",
    )
    expect(applicationUpdate.exitCode).toBe(0)
    expect(JSON.parse(applicationUpdate.stdout)).toMatchObject({
      application: { id: applicationId, name: "Gaps application renamed" },
    })

    const applicationLifecycle = await cliRun(
      "projects",
      "application-lifecycle",
      ...scoped,
      "--application-id",
      applicationId,
      "--status",
      "inactive",
    )
    expect(applicationLifecycle.exitCode).toBe(0)
    expect(JSON.parse(applicationLifecycle.stdout)).toMatchObject({
      application: { id: applicationId, status: "inactive" },
    })

    for (const [key, displayName] of [
      ["reader", "Reader"],
      ["editor", "Editor"],
    ] as const) {
      const role = await cliRun("projects", "role-create", ...scoped, "--key", key, "--display-name", displayName)
      expect(role.exitCode).toBe(0)
    }

    const roleList = await cliRun("projects", "role-list", ...scoped)
    expect(roleList.exitCode).toBe(0)
    const roleId = (JSON.parse(roleList.stdout) as { items: Array<{ id: string; key: string }> }).items.find(
      (item) => item.key === "reader",
    )?.id
    expect(roleId).toBeDefined()

    const roleUpdate = await cliRun(
      "projects",
      "role-update",
      ...scoped,
      "--role-id",
      roleId ?? "",
      "--display-name",
      "Reader renamed",
    )
    expect(roleUpdate.exitCode).toBe(0)
    expect(JSON.parse(roleUpdate.stdout)).toMatchObject({
      role: { id: roleId, displayName: "Reader renamed" },
    })

    const grantCreate = await cliRun(
      "projects",
      "grant-create",
      ...scoped,
      "--granted-organization-id",
      grantedOrganizationId,
      "--role-keys",
      "reader",
    )
    expect(grantCreate.exitCode).toBe(0)
    const grantId = (JSON.parse(grantCreate.stdout) as { grant: { id: string } }).grant.id

    const grantUpdate = await cliRun(
      "projects",
      "grant-update",
      ...scoped,
      "--grant-id",
      grantId,
      "--role-keys",
      "reader,editor",
    )
    expect(grantUpdate.exitCode).toBe(0)
    expect(JSON.parse(grantUpdate.stdout)).toMatchObject({
      grant: { id: grantId, roleKeys: ["reader", "editor"] },
    })

    const grantLifecycle = await cliRun(
      "projects",
      "grant-lifecycle",
      ...scoped,
      "--grant-id",
      grantId,
      "--status",
      "inactive",
    )
    expect(grantLifecycle.exitCode).toBe(0)
    expect(JSON.parse(grantLifecycle.stdout)).toMatchObject({
      grant: { id: grantId, status: "inactive" },
    })

    const accessCheck = await cliRun("projects", "access-check", ...scoped)
    expect(accessCheck.exitCode).toBe(0)
    expect(JSON.parse(accessCheck.stdout)).toMatchObject({ projectId })

    const grantDelete = await cliRun("projects", "grant-delete", ...scoped, "--grant-id", grantId)
    expect(grantDelete.exitCode).toBe(0)
    expect(JSON.parse(grantDelete.stdout)).toEqual({ deleted: true, grantId })

    const roleDelete = await cliRun("projects", "role-delete", ...scoped, "--role-id", roleId ?? "")
    expect(roleDelete.exitCode).toBe(0)
    expect(JSON.parse(roleDelete.stdout)).toEqual({ deleted: true, roleId })

    const applicationDelete = await cliRun(
      "projects",
      "application-delete",
      ...scoped,
      "--application-id",
      applicationId,
    )
    expect(applicationDelete.exitCode).toBe(0)
    expect(JSON.parse(applicationDelete.stdout)).toEqual({ applicationId, deleted: true })

    const projectDelete = await cliRun("projects", "delete", ...scoped)
    expect(projectDelete.exitCode).toBe(0)
    expect(JSON.parse(projectDelete.stdout)).toEqual({ deleted: true, projectId })
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
}, 30_000)

test("CLI machine credential issue and protected API round-trip through the composed server", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cli-machine-gaps-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "cli-machine-gaps-secret",
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({ fetch: created.data.fetch, port: 0 })
  const connection = ["--server", server.url.toString(), "--token", "cli-machine-gaps-secret"]

  try {
    const realmCreate = await cliRun(
      "realms",
      "create",
      ...connection,
      "--domain",
      "machine-gaps.example.com",
      "--name",
      "Machine gaps realm",
    )
    expect(realmCreate.exitCode).toBe(0)
    const realmId = (JSON.parse(realmCreate.stdout) as { realm: { id: string } }).realm.id

    const organizationCreate = await cliRun(
      "organizations",
      "create",
      ...connection,
      "--realm-id",
      realmId,
      "--name",
      "Machine gaps organization",
    )
    expect(organizationCreate.exitCode).toBe(0)
    const organizationId = (JSON.parse(organizationCreate.stdout) as { organization: { id: string } }).organization.id

    const machineCreate = await cliRun(
      "machine-users",
      "create",
      ...connection,
      "--realm-id",
      realmId,
      "--organization-id",
      organizationId,
      "--user-name",
      "machine-gaps-user",
      "--display-name",
      "Machine gaps user",
      "--scopes",
      "read",
    )
    expect(machineCreate.exitCode).toBe(0)
    const machineUserId = (JSON.parse(machineCreate.stdout) as { machineUser: { id: string } }).machineUser.id

    const credentialIssue = await cliRun(
      "machine-users",
      "credential-issue",
      ...connection,
      "--realm-id",
      realmId,
      "--organization-id",
      organizationId,
      "--machine-user-id",
      machineUserId,
      "--name",
      "gaps-credential",
      "--scopes",
      "read",
    )
    expect(credentialIssue.exitCode).toBe(0)
    const issued = JSON.parse(credentialIssue.stdout) as {
      credential: { id: string }
      secret: string
    }
    expect(issued.credential.id.length).toBeGreaterThan(0)
    expect(issued.secret.length).toBeGreaterThan(0)

    const credentialList = await cliRun(
      "machine-users",
      "credential-list",
      ...connection,
      "--realm-id",
      realmId,
      "--organization-id",
      organizationId,
      "--machine-user-id",
      machineUserId,
    )
    expect(credentialList.exitCode).toBe(0)
    const credentials = JSON.parse(credentialList.stdout) as { items: Array<{ id: string }> }
    expect(credentials.items.some((item) => item.id === issued.credential.id)).toBe(true)

    const protectedApi = await cliRun(
      "machine-users",
      "protected-api-get",
      "--server",
      server.url.toString(),
      "--token",
      issued.secret,
      "--realm-id",
      realmId,
    )
    expect(protectedApi.exitCode).toBe(0)
    expect(JSON.parse(protectedApi.stdout)).toMatchObject({
      machineUser: { id: machineUserId },
      scopes: ["read"],
    })
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

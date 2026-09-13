import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"

type CliRun = {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}

test("project assignment CLI supports membership, roles, listing, updates, and removal", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-project-assignment-cli-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "project-assignment-cli-secret",
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({ fetch: created.data.fetch, port: 0 })
  const connection = ["--server", server.url.toString(), "--token", "project-assignment-cli-secret"]

  try {
    const realm = await cliRun(
      "realms",
      "create",
      ...connection,
      "--domain",
      "project-assignment-cli.example.com",
      "--name",
      "Project assignment CLI",
    )
    expect(realm.exitCode).toBe(0)
    const realmId = (JSON.parse(realm.stdout) as { realm: { id: string } }).realm.id

    const organization = await cliRun(
      "organizations",
      "create",
      ...connection,
      "--realm-id",
      realmId,
      "--name",
      "Project assignment organization",
    )
    expect(organization.exitCode).toBe(0)
    const organizationId = (JSON.parse(organization.stdout) as { organization: { id: string } }).organization.id

    const project = await cliRun(
      "projects",
      "create",
      ...connection,
      "--realm-id",
      realmId,
      "--organization-id",
      organizationId,
      "--name",
      "Project assignment project",
    )
    expect(project.exitCode).toBe(0)
    const projectId = (JSON.parse(project.stdout) as { project: { id: string } }).project.id

    const user = await cliRun(
      "users",
      "create",
      ...connection,
      "--realm-id",
      realmId,
      "--user-name",
      "project-assignment-user",
      "--email",
      "project-assignment-user@example.com",
    )
    expect(user.exitCode).toBe(0)
    const userId = (JSON.parse(user.stdout) as { user: { id: string } }).user.id

    const roleUser = await cliRun(
      "users",
      "create",
      ...connection,
      "--realm-id",
      realmId,
      "--user-name",
      "project-assignment-role-user",
      "--email",
      "project-assignment-role-user@example.com",
    )
    expect(roleUser.exitCode).toBe(0)
    const roleUserId = (JSON.parse(roleUser.stdout) as { user: { id: string } }).user.id

    for (const [key, displayName] of [
      ["reader", "Reader"],
      ["editor", "Editor"],
    ] as const) {
      const role = await cliRun(
        "projects",
        "role-create",
        ...connection,
        "--realm-id",
        realmId,
        "--project-id",
        projectId,
        "--key",
        key,
        "--display-name",
        displayName,
      )
      expect(role.exitCode).toBe(0)
    }

    const membership = await cliRun(
      "projects",
      "assignment-create",
      ...connection,
      "--realm-id",
      realmId,
      "--project-id",
      projectId,
      "--user-id",
      userId,
    )
    expect(membership.exitCode).toBe(0)
    expect(JSON.parse(membership.stdout)).toMatchObject({ assignment: { userId, roleKeys: [] } })

    const roleAssignment = await cliRun(
      "projects",
      "assignment-create",
      ...connection,
      "--realm-id",
      realmId,
      "--project-id",
      projectId,
      "--user-id",
      roleUserId,
      "--role-keys",
      "reader,editor",
    )
    expect(roleAssignment.exitCode).toBe(0)
    const assignmentId = (JSON.parse(roleAssignment.stdout) as { assignment: { id: string } }).assignment.id
    expect(JSON.parse(roleAssignment.stdout)).toMatchObject({
      assignment: { userId: roleUserId, roleKeys: ["reader", "editor"] },
    })

    const listed = await cliRun(
      "projects",
      "assignment-list",
      ...connection,
      "--realm-id",
      realmId,
      "--project-id",
      projectId,
    )
    expect(listed.exitCode).toBe(0)
    const listedData = JSON.parse(listed.stdout) as { items: Array<{ roleKeys: string[]; userId: string }> }
    expect(listedData.items).toHaveLength(2)
    expect(
      listedData.items.some((item) => item.userId === roleUserId && item.roleKeys.join(",") === "reader,editor"),
    ).toBe(true)

    const updated = await cliRun(
      "projects",
      "assignment-update",
      ...connection,
      "--realm-id",
      realmId,
      "--project-id",
      projectId,
      "--assignment-id",
      assignmentId,
      "--role-keys",
      "reader",
    )
    expect(updated.exitCode).toBe(0)
    expect(JSON.parse(updated.stdout)).toMatchObject({ assignment: { roleKeys: ["reader"] } })

    const cleared = await cliRun(
      "projects",
      "assignment-update",
      ...connection,
      "--realm-id",
      realmId,
      "--project-id",
      projectId,
      "--assignment-id",
      assignmentId,
      "--role-keys",
      "",
    )
    expect(cleared.exitCode).toBe(0)
    expect(JSON.parse(cleared.stdout)).toMatchObject({ assignment: { roleKeys: [] } })

    const removed = await cliRun(
      "projects",
      "assignment-remove",
      ...connection,
      "--realm-id",
      realmId,
      "--project-id",
      projectId,
      "--assignment-id",
      assignmentId,
    )
    expect(removed.exitCode).toBe(0)
    expect(JSON.parse(removed.stdout)).toEqual({ removed: true })
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

test("project assignment aliases resolve local test users and central project selection", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-project-assignment-central-cli-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: "project-assignment-central-cli-secret",
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({ fetch: created.data.fetch, port: 0 })
  const connection: string[] = ["--server", server.url.toString(), "--token", "project-assignment-central-cli-secret"]

  try {
    const realm = await cliRun(
      "realms",
      "create",
      ...connection,
      "--domain",
      "central-assignment.example.com",
      "--name",
      "Central assignment CLI",
    )
    expect(realm.exitCode).toBe(0)
    const realmId = (JSON.parse(realm.stdout) as { realm: { id: string } }).realm.id

    const organization = await cliRun(
      "organizations",
      "create",
      ...connection,
      "--realm-id",
      realmId,
      "--name",
      "Central assignment organization",
    )
    expect(organization.exitCode).toBe(0)
    const organizationId = (JSON.parse(organization.stdout) as { organization: { id: string } }).organization.id

    const project = await cliRun(
      "projects",
      "create",
      ...connection,
      "--realm-id",
      realmId,
      "--organization-id",
      organizationId,
      "--name",
      "Central assignment project",
    )
    expect(project.exitCode).toBe(0)
    const projectId = (JSON.parse(project.stdout) as { project: { id: string } }).project.id

    const otherProject = await cliRun(
      "projects",
      "create",
      ...connection,
      "--realm-id",
      realmId,
      "--organization-id",
      organizationId,
      "--name",
      "Central assignment other project",
    )
    expect(otherProject.exitCode).toBe(0)
    const otherProjectId = (JSON.parse(otherProject.stdout) as { project: { id: string } }).project.id

    const user = await cliRun(
      "users",
      "create",
      ...connection,
      "--realm-id",
      realmId,
      "--user-name",
      "central-assignment-user",
      "--email",
      "central-assignment-user@example.com",
    )
    expect(user.exitCode).toBe(0)
    const userId = (JSON.parse(user.stdout) as { user: { id: string } }).user.id

    const admin = await cliRun(
      "users",
      "create",
      ...connection,
      "--realm-id",
      realmId,
      "--user-name",
      "central-assignment-admin",
      "--email",
      "central-assignment-admin@example.com",
    )
    expect(admin.exitCode).toBe(0)
    const adminId = (JSON.parse(admin.stdout) as { user: { id: string } }).user.id

    for (const { displayName, key } of [
      { displayName: "Reader", key: "reader" },
      { displayName: "Editor", key: "editor" },
    ] as const) {
      const role = await cliRun(
        "projects",
        "role-create",
        ...connection,
        "--realm-id",
        realmId,
        "--project-id",
        projectId,
        "--key",
        key,
        "--display-name",
        displayName,
      )
      expect(role.exitCode).toBe(0)
    }

    const configDirectory = join(directory, "config", "authworks")
    await mkdir(join(configDirectory, "credentials"), { recursive: true })
    await mkdir(join(configDirectory, "projects"), { recursive: true })
    await writeFile(
      join(configDirectory, "config.json"),
      JSON.stringify({ profiles: { local: { baseUrl: server.url.toString(), organizationId, realmId } } }),
    )
    await writeFile(
      join(configDirectory, "credentials", "local.json"),
      JSON.stringify({
        testUsers: {
          testadmin: { password: "unused", userId: adminId, username: "central-assignment-admin" },
          testuser: { password: "unused", userId, username: "central-assignment-user" },
        },
        token: "project-assignment-central-cli-secret",
      }),
    )
    await writeFile(join(configDirectory, "projects", "demo.json"), JSON.stringify({ profile: "local", projectId }))

    const assigned = await cliRunWithEnvironment(
      { ...centralCliEnvironment(directory), AUTHWORKS_PROJECT: undefined },
      "projects",
      "assign",
      "--token",
      "project-assignment-central-cli-secret",
      "--project",
      "demo",
      "--user-id",
      "testuser",
      "--role-keys",
      "reader",
    )
    expect(assigned.exitCode).toBe(0)
    const assignmentId = (JSON.parse(assigned.stdout) as { assignment: { id: string } }).assignment.id
    expect(JSON.parse(assigned.stdout)).toMatchObject({ assignment: { userId, roleKeys: ["reader"] } })

    const edited = await cliRunWithEnvironment(
      centralCliEnvironment(directory),
      "projects",
      "edit",
      "--token",
      "project-assignment-central-cli-secret",
      "--project",
      "demo",
      "--assignment-id",
      assignmentId,
      "--role-keys",
      "editor",
    )
    expect(edited.exitCode).toBe(0)
    expect(JSON.parse(edited.stdout)).toMatchObject({ assignment: { roleKeys: ["editor"] } })

    const explicitlySelected = await cliRunWithEnvironment(
      centralCliEnvironment(directory),
      "projects",
      "assign",
      "--token",
      "project-assignment-central-cli-secret",
      "--project",
      "demo",
      "--project-id",
      otherProjectId,
      "--user-id",
      "testadmin",
    )
    expect(explicitlySelected.exitCode).toBe(0)
    expect(JSON.parse(explicitlySelected.stdout)).toMatchObject({ assignment: { userId: adminId, roleKeys: [] } })

    const unassigned = await cliRunWithEnvironment(
      centralCliEnvironment(directory),
      "projects",
      "unassign",
      "--token",
      "project-assignment-central-cli-secret",
      "--project",
      "demo",
      "--assignment-id",
      assignmentId,
    )
    expect(unassigned.exitCode).toBe(0)
    expect(JSON.parse(unassigned.stdout)).toEqual({ removed: true })
  } finally {
    server.stop(true)
    await rm(directory, { force: true, recursive: true })
  }
})

async function cliRun(...args: string[]): Promise<CliRun> {
  const child = Bun.spawn(["bun", "src/outputs/cli.ts", ...args], {
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

function centralCliEnvironment(directory: string): Record<string, string | undefined> {
  return {
    AUTHWORKS_BASE_URL: undefined,
    AUTHWORKS_PROFILE: undefined,
    AUTHWORKS_PROJECT: "demo",
    AUTHWORKS_PROJECT_ID: undefined,
    AUTHWORKS_REALM_ID: undefined,
    AUTHWORKS_SERVER: undefined,
    AUTHWORKS_SYSTEM_SECRET: undefined,
    AUTHWORKS_TOKEN: undefined,
    AUTHWORKS_URL: undefined,
    XDG_CONFIG_HOME: join(directory, "config"),
  }
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
  const child = Bun.spawn(["bun", "src/outputs/cli.ts", ...args], { env: environment, stderr: "pipe", stdout: "pipe" })
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ])
  return { exitCode, stderr, stdout }
}

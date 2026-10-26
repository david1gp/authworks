import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../../compositions/serverApplicationCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { oidcAuthorizationRequestAuthorize } from "../../oidc/actions/oidcAuthorizationRequestAuthorize.js"
import { oidcClientCreate } from "../../oidc/actions/oidcClientCreate.js"
import { organizationCreate } from "../../organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../organizations/actions/organizationMembershipCreate.js"
import { organizationSwitch } from "../../organizations/actions/organizationSwitch.js"
import { passwordEmailVerify } from "../../passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../passwords/actions/passwordRegister.js"
import { realmAdministratorGrant } from "../../realms/actions/realmAdministratorGrant.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../realms/domain/realmTenantContextCreate.js"
import { sessionPasswordCreate } from "../../sessions/actions/sessionPasswordCreate.js"
import { userCreate } from "../../users/actions/userCreate.js"
import { userLifecycleSet } from "../../users/actions/userLifecycleSet.js"
import { projectCreate } from "../actions/projectCreate.js"
import { projectGet } from "../actions/projectGet.js"
import { projectGrantCreate } from "../actions/projectGrantCreate.js"
import { projectList } from "../actions/projectList.js"
import { projectRoleCreate } from "../actions/projectRoleCreate.js"
import { projectUpdate } from "../actions/projectUpdate.js"
import { projectUserAssignmentCreate } from "../actions/projectUserAssignmentCreate.js"
import { projectOidcContextValidate } from "./projectOidcContextValidate.js"
import { projectServerAppCreate } from "./projectServerAppCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-project-oidc-flags-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

function createRealm(database: StorageDatabase, domain: string) {
  const realm = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  return realm.data.realm
}

function createUser(database: StorageDatabase, realmId: string, email: string) {
  const created = userCreate({
    context: realmSystemContextCreate(),
    database,
    input: { email, profile: { displayName: email }, userName: email.split("@")[0] ?? email },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const activated = userLifecycleSet({
    context: realmSystemContextCreate(),
    database,
    input: { state: "active" },
    realmId,
    userId: created.data.user.id,
  })
  expect(activated.success).toBe(true)
  if (!activated.success) throw new Error(activated.errorMessage)
  return activated.data.user
}

function pkceChallengeCreate(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url")
}

test("project OIDC context passes without an assignment when both flags are off", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    const realm = createRealm(database, "project-flags-off.example.com")
    const organization = organizationCreate({ context: system, database, input: { name: "Owner" }, realmId: realm.id })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const project = projectCreate({
      context: system,
      database,
      input: {
        authorizationRequired: false,
        name: "Open project",
        organizationId: organization.data.organization.id,
        projectAccessRequired: false,
      },
      realmId: realm.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return
    const user = createUser(database, realm.id, "stranger@example.com")

    const validated = projectOidcContextValidate({
      executor: database.db,
      organizationId: organization.data.organization.id,
      projectId: project.data.project.id,
      realmId: realm.id,
      userId: user.id,
    })
    expect(validated.success).toBe(true)
  })
})

test("project access required denies logins without a project role and passes with one", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    const realm = createRealm(database, "project-access-required.example.com")
    const organization = organizationCreate({ context: system, database, input: { name: "Owner" }, realmId: realm.id })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const project = projectCreate({
      context: system,
      database,
      input: {
        authorizationRequired: false,
        name: "Role gated project",
        organizationId: organization.data.organization.id,
        projectAccessRequired: true,
      },
      realmId: realm.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return
    const role = projectRoleCreate({
      context: system,
      database,
      input: { displayName: "Reader", key: "reader" },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(role.success).toBe(true)
    if (!role.success) return
    const user = createUser(database, realm.id, "candidate@example.com")
    const context = {
      executor: database.db,
      organizationId: organization.data.organization.id,
      projectId: project.data.project.id,
      realmId: realm.id,
      userId: user.id,
    }

    const denied = projectOidcContextValidate(context)
    expect(denied.success).toBe(false)
    if (denied.success) return
    expect(denied.code).toBe("projects.invalid")

    const assignment = projectUserAssignmentCreate({
      context: system,
      database,
      input: { roleKeys: ["reader"], userId: user.id },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(assignment.success).toBe(true)

    const passed = projectOidcContextValidate(context)
    expect(passed.success).toBe(true)
  })
})

test("authorization required passes with an empty-role assignment and denies without one", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    const realm = createRealm(database, "project-authorization-required.example.com")
    const organization = organizationCreate({ context: system, database, input: { name: "Owner" }, realmId: realm.id })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const project = projectCreate({
      context: system,
      database,
      input: {
        authorizationRequired: true,
        name: "Membership gated project",
        organizationId: organization.data.organization.id,
        projectAccessRequired: false,
      },
      realmId: realm.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return
    const member = createUser(database, realm.id, "assigned@example.com")
    const stranger = createUser(database, realm.id, "unassigned@example.com")
    const assignment = projectUserAssignmentCreate({
      context: system,
      database,
      input: { userId: member.id },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(assignment.success).toBe(true)
    if (!assignment.success) return
    expect(assignment.data.assignment.roleKeys).toEqual([])

    const passed = projectOidcContextValidate({
      executor: database.db,
      organizationId: organization.data.organization.id,
      projectId: project.data.project.id,
      realmId: realm.id,
      userId: member.id,
    })
    expect(passed.success).toBe(true)

    const denied = projectOidcContextValidate({
      executor: database.db,
      organizationId: organization.data.organization.id,
      projectId: project.data.project.id,
      realmId: realm.id,
      userId: stranger.id,
    })
    expect(denied.success).toBe(false)
    if (denied.success) return
    expect(denied.code).toBe("projects.invalid")
  })
})

test("a cross-organization grant satisfies both flags for grantee members", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    const realm = createRealm(database, "project-cross-org-grant.example.com")
    const owner = organizationCreate({ context: system, database, input: { name: "Owner" }, realmId: realm.id })
    expect(owner.success).toBe(true)
    if (!owner.success) return
    const grantee = organizationCreate({ context: system, database, input: { name: "Grantee" }, realmId: realm.id })
    expect(grantee.success).toBe(true)
    if (!grantee.success) return
    const project = projectCreate({
      context: system,
      database,
      input: {
        authorizationRequired: true,
        name: "Shared project",
        organizationId: owner.data.organization.id,
        projectAccessRequired: true,
      },
      realmId: realm.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return
    const role = projectRoleCreate({
      context: system,
      database,
      input: { displayName: "Reader", key: "reader" },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(role.success).toBe(true)
    if (!role.success) return
    const grant = projectGrantCreate({
      context: system,
      database,
      input: { grantedOrganizationId: grantee.data.organization.id, roleKeys: ["reader"] },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(grant.success).toBe(true)
    if (!grant.success) return
    const member = createUser(database, realm.id, "grantee-member@example.com")
    const membership = organizationMembershipCreate({
      context: system,
      database,
      input: { roles: ["member"], userId: member.id },
      organizationId: grantee.data.organization.id,
      realmId: realm.id,
    })
    expect(membership.success).toBe(true)
    if (!membership.success) return

    const passed = projectOidcContextValidate({
      executor: database.db,
      organizationId: grantee.data.organization.id,
      projectId: project.data.project.id,
      realmId: realm.id,
      userId: member.id,
    })
    expect(passed.success).toBe(true)

    const outsider = createUser(database, realm.id, "outsider@example.com")
    const denied = projectOidcContextValidate({
      executor: database.db,
      organizationId: grantee.data.organization.id,
      projectId: project.data.project.id,
      realmId: realm.id,
      userId: outsider.id,
    })
    expect(denied.success).toBe(false)

    const memberContext = realmTenantContextCreate(realm.id, member.id)
    const grantedList = projectList({
      context: memberContext,
      database,
      grantedToOrganizationId: grantee.data.organization.id,
      realmId: realm.id,
    })
    expect(grantedList.success).toBe(true)
    if (!grantedList.success) return
    expect(grantedList.data.items.map((item) => item.id)).toEqual([project.data.project.id])

    const otherList = projectList({
      context: memberContext,
      database,
      grantedToOrganizationId: owner.data.organization.id,
      realmId: realm.id,
    })
    expect(otherList.success).toBe(true)
    if (!otherList.success) return
    expect(otherList.data.items.map((item) => item.id)).toEqual([project.data.project.id])

    const unrelated = organizationCreate({ context: system, database, input: { name: "Unrelated" }, realmId: realm.id })
    expect(unrelated.success).toBe(true)
    if (!unrelated.success) return
    const unrelatedList = projectList({
      context: memberContext,
      database,
      grantedToOrganizationId: unrelated.data.organization.id,
      realmId: realm.id,
    })
    expect(unrelatedList.success).toBe(true)
    if (!unrelatedList.success) return
    expect(unrelatedList.data.items.map((item) => item.id)).toEqual([])

    const grantedGet = projectGet({
      context: memberContext,
      database,
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(grantedGet.success).toBe(true)
  })
})

test("realm administrators are denied like everyone else without a project authorization", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    const realm = createRealm(database, "project-realm-admin.example.com")
    const organization = organizationCreate({ context: system, database, input: { name: "Owner" }, realmId: realm.id })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const project = projectCreate({
      context: system,
      database,
      input: {
        authorizationRequired: true,
        name: "Gated project",
        organizationId: organization.data.organization.id,
        projectAccessRequired: true,
      },
      realmId: realm.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return
    const administrator = createUser(database, realm.id, "realm-admin@example.com")
    const granted = realmAdministratorGrant({
      context: system,
      database,
      realmId: realm.id,
      userId: administrator.id,
    })
    expect(granted.success).toBe(true)
    if (!granted.success) return

    const denied = projectOidcContextValidate({
      executor: database.db,
      organizationId: organization.data.organization.id,
      projectId: project.data.project.id,
      realmId: realm.id,
      userId: administrator.id,
    })
    expect(denied.success).toBe(false)
    if (denied.success) return
    expect(denied.code).toBe("projects.invalid")
  })
})

test("the OIDC authorize gate denies role-gated projects with the generic authorization error", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    const realm = createRealm(database, "project-authorize-gate.example.com")
    const realmId = realm.id
    const anonymous = realmTenantContextCreate(realmId, "anonymous")
    let verificationToken = ""
    const registered = passwordRegister({
      context: anonymous,
      database,
      input: {
        email: "gate-user@example.com",
        password: "Correct Horse 12",
        profile: { displayName: "Gate User" },
        userName: "gate-user",
      },
      onVerificationToken: (delivery) => {
        verificationToken = delivery.token
      },
      realmId,
    })
    expect(registered.success).toBe(true)
    if (!registered.success) return
    expect(
      passwordEmailVerify({ context: anonymous, database, input: { token: verificationToken }, realmId }).success,
    ).toBe(true)
    const login = passwordLogin({
      context: anonymous,
      database,
      input: { identifier: "gate-user", password: "Correct Horse 12" },
      realmId,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(login.success).toBe(true)
    if (!login.success || login.data.session === undefined) throw new Error("The gate session failed.")
    const userId = login.data.authentication.userId
    const organization = organizationCreate({
      context: system,
      database,
      input: { name: "Gate org", ownerUserId: userId },
      realmId,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const organizationId = organization.data.organization.id
    const switched = organizationSwitch({
      context: realmTenantContextCreate(realmId, userId),
      database,
      input: { organizationId },
      realmId,
      sessionId: login.data.session.session.id,
    })
    expect(switched.success).toBe(true)

    const open = projectCreate({
      context: system,
      database,
      input: {
        authorizationRequired: false,
        name: "Open login project",
        organizationId,
        projectAccessRequired: false,
      },
      realmId,
    })
    expect(open.success).toBe(true)
    if (!open.success) return
    const gated = projectCreate({
      context: system,
      database,
      input: {
        authorizationRequired: false,
        name: "Role login project",
        organizationId,
        projectAccessRequired: true,
      },
      realmId,
    })
    expect(gated.success).toBe(true)
    if (!gated.success) return
    const role = projectRoleCreate({
      context: system,
      database,
      input: { displayName: "Reader", key: "reader" },
      projectId: gated.data.project.id,
      realmId,
    })
    expect(role.success).toBe(true)
    if (!role.success) return

    const clientInput = {
      clientType: "public" as const,
      name: "Gate client",
      redirectUris: ["https://client.example/callback"],
      trusted: true,
    }
    const openClient = oidcClientCreate({
      context: system,
      database,
      input: { ...clientInput, name: "Open gate client", projectId: open.data.project.id },
      realmId,
    })
    expect(openClient.success).toBe(true)
    if (!openClient.success) return
    const gatedClient = oidcClientCreate({
      context: system,
      database,
      input: { ...clientInput, name: "Role gate client", projectId: gated.data.project.id },
      realmId,
    })
    expect(gatedClient.success).toBe(true)
    if (!gatedClient.success) return

    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const requestInput = {
      client_id: openClient.data.client.id,
      code_challenge: pkceChallengeCreate(verifier),
      code_challenge_method: "S256" as const,
      redirect_uri: "https://client.example/callback",
      response_type: "code" as const,
      scope: "openid",
      state: "open-state",
    }
    const openRequest = oidcAuthorizationRequestAuthorize({
      database,
      input: requestInput,
      realmId,
      sessionToken: login.data.session.token,
    })
    expect(openRequest.success).toBe(true)

    const denied = oidcAuthorizationRequestAuthorize({
      database,
      input: { ...requestInput, client_id: gatedClient.data.client.id, state: "gated-state" },
      realmId,
      sessionToken: login.data.session.token,
    })
    expect(denied.success).toBe(false)
    if (denied.success) return
    expect(denied.errorMessage).toBe("The OIDC authorization request is invalid.")
    expect(denied.code).toBe("oidc.invalid-request")

    const assignment = projectUserAssignmentCreate({
      context: system,
      database,
      input: { roleKeys: ["reader"], userId },
      projectId: gated.data.project.id,
      realmId,
    })
    expect(assignment.success).toBe(true)
    const passed = oidcAuthorizationRequestAuthorize({
      database,
      input: { ...requestInput, client_id: gatedClient.data.client.id, state: "gated-state" },
      realmId,
      sessionToken: login.data.session.token,
    })
    expect(passed.success).toBe(true)
  })
})

test("the project list route accepts the granted-to organization filter", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    const domain = "project-granted-route.example.com"
    const realm = createRealm(database, domain)
    const owner = organizationCreate({ context: system, database, input: { name: "Owner" }, realmId: realm.id })
    expect(owner.success).toBe(true)
    if (!owner.success) return
    const grantee = organizationCreate({ context: system, database, input: { name: "Grantee" }, realmId: realm.id })
    expect(grantee.success).toBe(true)
    if (!grantee.success) return
    const project = projectCreate({
      context: system,
      database,
      input: {
        authorizationRequired: false,
        name: "Granted route project",
        organizationId: owner.data.organization.id,
        projectAccessRequired: false,
      },
      realmId: realm.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return
    const grant = projectGrantCreate({
      context: system,
      database,
      input: { grantedOrganizationId: grantee.data.organization.id, roleKeys: [] },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(grant.success).toBe(true)
    if (!grant.success) return

    const systemToken = "granted-secret"
    const app = projectServerAppCreate({ database, publicOrigin: `https://${domain}`, systemSecret: systemToken })
    const granted = await app.request(
      `https://${domain}/system/realms/${realm.id}/projects?grantedToOrganizationId=${grantee.data.organization.id}&pageSize=100`,
      { headers: { authorization: `Bearer ${systemToken}` } },
    )
    expect(granted.status).toBe(200)
    const grantedBody = (await granted.json()) as { items: { id: string }[] }
    expect(grantedBody.items.map((item) => item.id)).toEqual([project.data.project.id])

    const missing = await app.request(
      `https://${domain}/system/realms/${realm.id}/projects?grantedToOrganizationId=not-an-id`,
      { headers: { authorization: `Bearer ${systemToken}` } },
    )
    expect(missing.status).toBe(400)
  })
})

type CliRun = {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}

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

test("project CLI create and update round-trip the authorization flags", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-project-flags-cli-"))
  const systemToken = "project-flags-cli-secret"
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret: systemToken,
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const server = Bun.serve({ fetch: created.data.fetch, port: 0 })
  try {
    const adminArgs = ["--server", server.url.toString(), "--token", systemToken] as const
    const realm = await cliRun(
      "realms",
      "create",
      ...adminArgs,
      "--domain",
      "project-flags-cli.example.com",
      "--name",
      "Flags CLI realm",
    )
    expect(realm.exitCode).toBe(0)
    if (realm.exitCode !== 0) throw new Error(realm.stderr)
    const realmId = (JSON.parse(realm.stdout) as { readonly realm: { readonly id: string } }).realm.id
    const owner = await cliRun(
      "organizations",
      "create",
      ...adminArgs,
      "--realm-id",
      realmId,
      "--name",
      "Flags CLI owner",
    )
    expect(owner.exitCode).toBe(0)
    if (owner.exitCode !== 0) throw new Error(owner.stderr)
    const organizationId = (JSON.parse(owner.stdout) as { readonly organization: { readonly id: string } }).organization
      .id
    const grantee = await cliRun(
      "organizations",
      "create",
      ...adminArgs,
      "--realm-id",
      realmId,
      "--name",
      "Flags CLI grantee",
    )
    expect(grantee.exitCode).toBe(0)
    if (grantee.exitCode !== 0) throw new Error(grantee.stderr)
    const granteeId = (JSON.parse(grantee.stdout) as { readonly organization: { readonly id: string } }).organization.id

    const project = await cliRun(
      "projects",
      "create",
      ...adminArgs,
      "--realm-id",
      realmId,
      "--organization-id",
      organizationId,
      "--name",
      "Flags CLI project",
      "--authorization-required",
      "--project-access-required",
    )
    expect(project.exitCode).toBe(0)
    if (project.exitCode !== 0) throw new Error(project.stderr)
    const createdProject = (JSON.parse(project.stdout) as { readonly project: { readonly id: string } }).project
    expect(JSON.parse(project.stdout)).toMatchObject({
      project: { authorizationRequired: true, projectAccessRequired: true },
    })

    const renamed = await cliRun(
      "projects",
      "update",
      ...adminArgs,
      "--realm-id",
      realmId,
      "--project-id",
      createdProject.id,
      "--name",
      "Flags CLI project renamed",
      "--no-project-access-required",
    )
    expect(renamed.exitCode).toBe(0)
    if (renamed.exitCode !== 0) throw new Error(renamed.stderr)
    expect(JSON.parse(renamed.stdout)).toMatchObject({
      project: { authorizationRequired: true, name: "Flags CLI project renamed", projectAccessRequired: false },
    })

    const role = await cliRun(
      "projects",
      "role-create",
      ...adminArgs,
      "--realm-id",
      realmId,
      "--project-id",
      createdProject.id,
      "--key",
      "reader",
      "--display-name",
      "Reader",
    )
    expect(role.exitCode).toBe(0)
    if (role.exitCode !== 0) throw new Error(role.stderr)
    const grant = await cliRun(
      "projects",
      "grant-create",
      ...adminArgs,
      "--realm-id",
      realmId,
      "--project-id",
      createdProject.id,
      "--granted-organization-id",
      granteeId,
      "--role-keys",
      "reader",
    )
    expect(grant.exitCode).toBe(0)
    if (grant.exitCode !== 0) throw new Error(grant.stderr)

    const granted = await cliRun(
      "projects",
      "list",
      ...adminArgs,
      "--realm-id",
      realmId,
      "--granted-to-organization-id",
      granteeId,
    )
    expect(granted.exitCode).toBe(0)
    if (granted.exitCode !== 0) throw new Error(granted.stderr)
    expect(
      (JSON.parse(granted.stdout) as { readonly items: { readonly id: string }[] }).items.map((item) => item.id),
    ).toEqual([createdProject.id])
  } finally {
    server.stop()
    await rm(directory, { force: true, recursive: true })
  }
})

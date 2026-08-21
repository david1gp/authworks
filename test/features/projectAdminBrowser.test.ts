import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { projectCreate } from "../../src/features/projects/actions/projectCreate.js"
import { projectApiClientCreate } from "../../src/features/projects/client/projectApiClientCreate.js"
import { projectServerAppCreate } from "../../src/features/projects/server/projectServerAppCreate.js"
import { realmBootstrapAdminCreate } from "../../src/features/realms/actions/realmBootstrapAdminCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-project-admin-browser-"))
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), platformTestkitCreate().runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

test("browser project administration accepts bootstrap-admin cookies and preserves bearer paths", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const realm = realmCreate({
      context: system,
      database,
      input: { domain: "project-admin.example.com", name: "Project admin" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const bootstrap = realmBootstrapAdminCreate({ context: system, database, realmId: realm.data.realm.id })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return
    const organization = organizationCreate({
      context: system,
      database,
      input: { name: "Project organization", ownerUserId: "bootstrap-owner" },
      realmId: realm.data.realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const project = projectCreate({
      context: system,
      database,
      input: {
        authorizationRequired: false,
        name: "Existing project",
        organizationId: organization.data.organization.id,
        projectAccessRequired: false,
      },
      realmId: realm.data.realm.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return
    const session = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "bootstrap_admin",
      database,
      realmId: realm.data.realm.id,
      subjectId: bootstrap.data.bootstrapAdmin.adminId,
      subjectType: "bootstrap_admin",
    })
    expect(session.success).toBe(true)
    if (!session.success) return
    const csrf = sessionCsrfTokenCreate(database.runtime)
    const app = projectServerAppCreate({ database, publicOrigin: "https://project-admin.example.com" })
    const cookieHeaders = {
      cookie: `session=${session.data.token}; csrf=${csrf}`,
      host: "project-admin.example.com",
      origin: "https://project-admin.example.com",
      "x-csrf-token": csrf,
    }

    const missing = await app.request(`https://project-admin.example.com/realms/${realm.data.realm.id}/projects`, {
      headers: { host: "project-admin.example.com" },
    })
    expect(missing.status).toBe(401)
    const listed = await app.request(`https://project-admin.example.com/realms/${realm.data.realm.id}/projects`, {
      headers: cookieHeaders,
    })
    expect(listed.status).toBe(200)
    const listedBody = await listed.json()
    expect(listedBody).toMatchObject({ items: [{ id: project.data.project.id }] })

    const missingOrigin = await app.request(
      `https://project-admin.example.com/realms/${realm.data.realm.id}/projects/${project.data.project.id}/lifecycle`,
      {
        body: JSON.stringify({ status: "inactive" }),
        headers: { cookie: cookieHeaders.cookie, "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(missingOrigin.status).toBe(403)
    const lifecycle = await app.request(
      `https://project-admin.example.com/realms/${realm.data.realm.id}/projects/${project.data.project.id}/lifecycle`,
      {
        body: JSON.stringify({ status: "inactive" }),
        headers: { ...cookieHeaders, "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(lifecycle.status).toBe(200)

    const bearer = await app.request(`https://project-admin.example.com/realms/${realm.data.realm.id}/projects`, {
      headers: {
        authorization: `Bearer ${bootstrap.data.bootstrapAdmin.secret.valueGet()}`,
        host: "project-admin.example.com",
      },
    })
    expect(bearer.status).toBe(200)
    const systemDenied = await app.request(
      `https://project-admin.example.com/system/realms/${realm.data.realm.id}/projects`,
      { headers: { host: "project-admin.example.com" } },
    )
    expect(systemDenied.status).toBe(401)
    expect(JSON.stringify(listedBody)).not.toContain(bootstrap.data.bootstrapAdmin.secret.valueGet())
  })
})

test("browser project administration enforces delegated permissions, tenant isolation, pagination, and tenant clients", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const realm = realmCreate({
      context: system,
      database,
      input: { domain: "project-client.example.com", name: "Project client" },
    })
    const otherRealm = realmCreate({
      context: system,
      database,
      input: { domain: "other-project-client.example.com", name: "Other project client" },
    })
    expect(realm.success && otherRealm.success).toBe(true)
    if (!realm.success || !otherRealm.success) return
    const user = userCreate({
      context: system,
      database,
      input: {
        email: "project-owner@example.com",
        profile: { displayName: "Project owner" },
        userName: "project-owner",
      },
      realmId: realm.data.realm.id,
    })
    expect(user.success).toBe(true)
    if (!user.success) return
    const active = userLifecycleSet({
      context: system,
      database,
      input: { state: "active" },
      realmId: realm.data.realm.id,
      userId: user.data.user.id,
    })
    expect(active.success).toBe(true)
    const organization = organizationCreate({
      context: system,
      database,
      input: { name: "Owner organization", ownerUserId: user.data.user.id },
      realmId: realm.data.realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const memberUser = userCreate({
      context: system,
      database,
      input: {
        email: "project-member@example.com",
        profile: { displayName: "Project member" },
        userName: "project-member",
      },
      realmId: realm.data.realm.id,
    })
    expect(memberUser.success).toBe(true)
    if (!memberUser.success) return
    const memberActive = userLifecycleSet({
      context: system,
      database,
      input: { state: "active" },
      realmId: realm.data.realm.id,
      userId: memberUser.data.user.id,
    })
    expect(memberActive.success).toBe(true)
    const member = organizationMembershipCreate({
      context: system,
      database,
      input: { roles: ["member"], userId: memberUser.data.user.id },
      organizationId: organization.data.organization.id,
      realmId: realm.data.realm.id,
    })
    expect(member.success).toBe(true)
    const first = projectCreate({
      context: system,
      database,
      input: {
        authorizationRequired: false,
        name: "First project",
        organizationId: organization.data.organization.id,
        projectAccessRequired: false,
      },
      realmId: realm.data.realm.id,
    })
    const second = projectCreate({
      context: system,
      database,
      input: {
        authorizationRequired: false,
        name: "Second project",
        organizationId: organization.data.organization.id,
        projectAccessRequired: false,
      },
      realmId: realm.data.realm.id,
    })
    expect(first.success && second.success).toBe(true)
    if (!first.success || !second.success) return
    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.data.realm.id,
      subjectId: user.data.user.id,
      subjectType: "user",
      userId: user.data.user.id,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return
    const csrf = sessionCsrfTokenCreate(database.runtime)
    const app = projectServerAppCreate({ database, publicOrigin: "https://project-client.example.com" })
    const client = projectApiClientCreate({
      baseUrl: "https://project-client.example.com",
      csrfToken: csrf,
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers)
        headers.set("cookie", `session=${issued.data.token}; csrf=${csrf}`)
        headers.set("host", "project-client.example.com")
        headers.set("origin", "https://project-client.example.com")
        return app.request(input.toString(), { ...init, headers })
      },
    })
    const page = await client.projectTenantList(realm.data.realm.id, { pageSize: 1 })
    expect(page).toMatchObject({ success: true, data: { items: [{ name: "First project" }] } })
    expect(page.success && page.data.nextPageToken).toBeDefined()
    expect((await client.projectTenantGet(realm.data.realm.id, first.data.project.id)).success).toBe(true)
    expect(
      (
        await client.projectTenantApplicationCreate(realm.data.realm.id, first.data.project.id, {
          applicationType: "api",
          name: "Project API",
        })
      ).success,
    ).toBe(true)

    const crossRealm = await app.request(
      `https://project-client.example.com/realms/${otherRealm.data.realm.id}/projects`,
      {
        headers: { cookie: `session=${issued.data.token}` },
      },
    )
    expect(crossRealm.status).toBe(401)
    const memberSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.data.realm.id,
      subjectId: memberUser.data.user.id,
      subjectType: "user",
      userId: memberUser.data.user.id,
    })
    expect(memberSession.success).toBe(true)
    if (!memberSession.success) return
    const denied = await app.request(`https://project-client.example.com/realms/${realm.data.realm.id}/projects`, {
      headers: { cookie: `session=${memberSession.data.token}`, host: "project-client.example.com" },
    })
    expect(denied.status).toBe(403)
  })
})

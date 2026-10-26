import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { machineUserCreate } from "../../src/features/machineUsers/actions/machineUserCreate.js"
import { machineUserLifecycleSet } from "../../src/features/machineUsers/actions/machineUserLifecycleSet.js"
import { machineUserServerAppCreate } from "../../src/features/machineUsers/server/machineUserServerAppCreate.js"
import { realmBootstrapAdminCreate } from "../../src/features/realms/actions/realmBootstrapAdminCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-machine-user-update-"))
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

async function realmWithOrganization(database: StorageDatabase, domain: string) {
  const system = realmSystemContextCreate("system")
  const realm = realmCreate({ context: system, database, input: { domain, name: domain } })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const organization = organizationCreate({
    context: system,
    database,
    input: { name: "Update org" },
    realmId: realm.data.realm.id,
  })
  expect(organization.success).toBe(true)
  if (!organization.success) throw new Error(organization.errorMessage)
  const bootstrap = realmBootstrapAdminCreate({ context: system, database, realmId: realm.data.realm.id })
  expect(bootstrap.success).toBe(true)
  if (!bootstrap.success) throw new Error(bootstrap.errorMessage)
  return {
    bootstrap: bootstrap.data.bootstrapAdmin,
    organizationId: organization.data.organization.id,
    realm: realm.data.realm,
  }
}

function tenantRequest(
  app: ReturnType<typeof machineUserServerAppCreate>,
  database: StorageDatabase,
  origin: string,
  token: string,
  path: string,
  body: unknown,
) {
  const csrf = sessionCsrfTokenCreate(database.runtime)
  return app.request(`${origin}${path}`, {
    body: JSON.stringify(body),
    headers: {
      cookie: `session=${token}; csrf=${csrf}`,
      origin,
      "content-type": "application/json",
      "x-csrf-token": csrf,
    },
    method: "PATCH",
  })
}

test("machine user tenant update changes display name and scopes with an event", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const { bootstrap, organizationId, realm } = await realmWithOrganization(database, "machine-update.example.com")
    const created = machineUserCreate({
      context: system,
      database,
      input: { displayName: "Old name", scopes: ["event.read"], userName: "updatable" },
      organizationId,
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const session = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "bootstrap_admin",
      database,
      realmId: realm.id,
      subjectId: bootstrap.adminId,
      subjectType: "bootstrap_admin",
    })
    expect(session.success).toBe(true)
    if (!session.success) return
    const app = machineUserServerAppCreate({
      database,
      publicOrigin: `https://${realm.domain}`,
      systemSecret: "system-secret",
    })
    const response = await tenantRequest(
      app,
      database,
      `https://${realm.domain}`,
      session.data.token,
      `/realms/${realm.id}/machine-users/${created.data.machineUser.id}?organizationId=${organizationId}`,
      { displayName: "New name", scopes: ["event.read", "user.read"] },
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { machineUser: { displayName: string; scopes: string[] } }
    expect(body.machineUser.displayName).toBe("New name")
    expect(body.machineUser.scopes).toEqual(["event.read", "user.read"])
    expect(JSON.stringify(body)).not.toContain(created.data.clientSecret)
    const events = database.db
      .select()
      .from(storageEventTable)
      .where(eq(storageEventTable.aggregateId, created.data.machineUser.id))
      .all()
    expect(events.some((event) => event.eventType === "machine.user_updated")).toBe(true)
  })
})

test("machine user update rejects unknown scopes and removed users", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const { bootstrap, organizationId, realm } = await realmWithOrganization(
      database,
      "machine-update-invalid.example.com",
    )
    const created = machineUserCreate({
      context: system,
      database,
      input: { displayName: "Scoped", scopes: ["event.read"], userName: "scoped" },
      organizationId,
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const session = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "bootstrap_admin",
      database,
      realmId: realm.id,
      subjectId: bootstrap.adminId,
      subjectType: "bootstrap_admin",
    })
    expect(session.success).toBe(true)
    if (!session.success) return
    const app = machineUserServerAppCreate({
      database,
      publicOrigin: `https://${realm.domain}`,
      systemSecret: "system-secret",
    })
    const origin = `https://${realm.domain}`
    const path = `/realms/${realm.id}/machine-users/${created.data.machineUser.id}?organizationId=${organizationId}`
    const invalid = await tenantRequest(app, database, origin, session.data.token, path, {
      displayName: "Scoped",
      scopes: ["not.a.scope"],
    })
    expect(invalid.status).toBe(400)
    expect(((await invalid.json()) as { error: { code: string } }).error.code).toBe("machine-users.invalid-scope")

    const removed = machineUserLifecycleSet({
      context: system,
      database,
      input: { status: "removed" },
      machineUserId: created.data.machineUser.id,
      organizationId,
      realmId: realm.id,
    })
    expect(removed.success).toBe(true)
    const afterRemove = await tenantRequest(app, database, origin, session.data.token, path, {
      displayName: "Resurrected",
    })
    expect(afterRemove.status).toBe(409)
    expect(((await afterRemove.json()) as { error: { code: string } }).error.code).toBe("machine-users.not-active")
  })
})

test("machine user update is isolated to its organization", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const { bootstrap, organizationId, realm } = await realmWithOrganization(
      database,
      "machine-update-tenant.example.com",
    )
    const foreign = organizationCreate({ context: system, database, input: { name: "Foreign org" }, realmId: realm.id })
    expect(foreign.success).toBe(true)
    if (!foreign.success) return
    const created = machineUserCreate({
      context: system,
      database,
      input: { displayName: "Isolated", userName: "isolated" },
      organizationId,
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const session = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "bootstrap_admin",
      database,
      realmId: realm.id,
      subjectId: bootstrap.adminId,
      subjectType: "bootstrap_admin",
    })
    expect(session.success).toBe(true)
    if (!session.success) return
    const app = machineUserServerAppCreate({
      database,
      publicOrigin: `https://${realm.domain}`,
      systemSecret: "system-secret",
    })
    const response = await tenantRequest(
      app,
      database,
      `https://${realm.domain}`,
      session.data.token,
      `/realms/${realm.id}/machine-users/${created.data.machineUser.id}?organizationId=${foreign.data.organization.id}`,
      { displayName: "Hijacked" },
    )
    expect(response.status).toBe(404)
  })
})

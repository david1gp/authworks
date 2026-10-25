import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationLifecycleSet } from "../../src/features/organizations/actions/organizationLifecycleSet.js"
import { organizationList } from "../../src/features/organizations/actions/organizationList.js"
import { projectCreate } from "../../src/features/projects/actions/projectCreate.js"
import { projectLifecycleSet } from "../../src/features/projects/actions/projectLifecycleSet.js"
import { projectList } from "../../src/features/projects/actions/projectList.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-admin-list-search-status-"))
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

async function createRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({
    context: realmSystemContextCreate(),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

async function createActiveUser(database: StorageDatabase, realmId: string, email: string) {
  const system = realmSystemContextCreate()
  const created = userCreate({
    context: system,
    database,
    input: { email, profile: { displayName: email }, userName: email.split("@")[0] ?? email },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const active = userLifecycleSet({
    context: system,
    database,
    input: { state: "active" },
    realmId,
    userId: created.data.user.id,
  })
  expect(active.success).toBe(true)
  if (!active.success) throw new Error(active.errorMessage)
  return created.data.user
}

test("project list applies server-side search before pagination", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    const realm = await createRealm(database, "project-search.example.com")
    const organization = organizationCreate({
      context: system,
      database,
      input: { name: "Search Org" },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const organizationId = organization.data.organization.id
    for (const name of ["Zulu project", "Alpha project", "Mike project"]) {
      const created = projectCreate({
        context: system,
        database,
        input: { authorizationRequired: false, name, organizationId, projectAccessRequired: false },
        realmId: realm.id,
      })
      expect(created.success).toBe(true)
      if (!created.success) return
    }

    // The match is last alphabetically, so a page-only filter on the first page would miss it.
    const searched = projectList({
      context: system,
      database,
      query: { pageSize: 1, search: "zulu" },
      realmId: realm.id,
    })
    expect(searched.success).toBe(true)
    if (!searched.success) return
    expect(searched.data.items.map((item) => item.name)).toEqual(["Zulu project"])
  })
})

test("project list filters deactivated projects by status", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    const realm = await createRealm(database, "project-status.example.com")
    const organization = organizationCreate({
      context: system,
      database,
      input: { name: "Status Org" },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const organizationId = organization.data.organization.id
    const active = projectCreate({
      context: system,
      database,
      input: { authorizationRequired: false, name: "Active project", organizationId, projectAccessRequired: false },
      realmId: realm.id,
    })
    expect(active.success).toBe(true)
    if (!active.success) return
    const dormant = projectCreate({
      context: system,
      database,
      input: { authorizationRequired: false, name: "Dormant project", organizationId, projectAccessRequired: false },
      realmId: realm.id,
    })
    expect(dormant.success).toBe(true)
    if (!dormant.success) return
    const deactivated = projectLifecycleSet({
      context: system,
      database,
      input: { status: "inactive" },
      projectId: dormant.data.project.id,
      realmId: realm.id,
    })
    expect(deactivated.success).toBe(true)
    if (!deactivated.success) return

    const listedDefault = projectList({ context: system, database, realmId: realm.id })
    expect(listedDefault.success).toBe(true)
    if (!listedDefault.success) return
    expect(listedDefault.data.items.map((item) => item.name)).toEqual(["Active project"])

    const listedAll = projectList({ context: system, database, query: { status: "all" }, realmId: realm.id })
    expect(listedAll.success).toBe(true)
    if (!listedAll.success) return
    expect(listedAll.data.items.map((item) => item.name).sort()).toEqual(["Active project", "Dormant project"])

    const listedInactive = projectList({
      context: system,
      database,
      query: { status: "inactive" },
      realmId: realm.id,
    })
    expect(listedInactive.success).toBe(true)
    if (!listedInactive.success) return
    expect(listedInactive.data.items.map((item) => item.name)).toEqual(["Dormant project"])
  })
})

test("organization list applies server-side search and exposes inactive organizations", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    const realm = await createRealm(database, "organization-search.example.com")
    const owner = await createActiveUser(database, realm.id, "owner@example.com")
    const visible = organizationCreate({
      context: system,
      database,
      input: { name: "Visible Org", ownerUserId: owner.id },
      realmId: realm.id,
    })
    expect(visible.success).toBe(true)
    if (!visible.success) return
    const hidden = organizationCreate({
      context: system,
      database,
      input: { name: "Hidden Org", ownerUserId: owner.id },
      realmId: realm.id,
    })
    expect(hidden.success).toBe(true)
    if (!hidden.success) return
    const deactivated = organizationLifecycleSet({
      context: system,
      database,
      input: { status: "inactive" },
      organizationId: hidden.data.organization.id,
      realmId: realm.id,
    })
    expect(deactivated.success).toBe(true)
    if (!deactivated.success) return

    const searched = organizationList({ context: system, database, query: { search: "visible" }, realmId: realm.id })
    expect(searched.success).toBe(true)
    if (!searched.success) return
    expect(searched.data.items.map((item) => item.name)).toEqual(["Visible Org"])

    const tenant = realmTenantContextCreate(realm.id, owner.id)
    const tenantDefault = organizationList({ context: tenant, database, realmId: realm.id })
    expect(tenantDefault.success).toBe(true)
    if (!tenantDefault.success) return
    expect(tenantDefault.data.items.map((item) => item.name)).toEqual(["Visible Org"])

    const tenantAll = organizationList({
      context: tenant,
      database,
      query: { status: "all" },
      realmId: realm.id,
    })
    expect(tenantAll.success).toBe(true)
    if (!tenantAll.success) return
    expect(tenantAll.data.items.map((item) => item.name).sort()).toEqual(["Hidden Org", "Visible Org"])
  })
})

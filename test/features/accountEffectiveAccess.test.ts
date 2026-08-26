import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { accountEffectiveAccessList } from "../../src/features/account/actions/accountEffectiveAccessList.js"
import { accountApiClientCreate } from "../../src/features/account/client/accountApiClientCreate.js"
import { accountServerAppCreate } from "../../src/features/account/server/accountServerAppCreate.js"
import { authorizationRoleKeysResolve } from "../../src/features/authorization/actions/authorizationRoleKeysResolve.js"
import { impersonationStart } from "../../src/features/impersonation/actions/impersonationStart.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { projectAccountAccessList } from "../../src/features/projects/actions/projectAccountAccessList.js"
import { projectCreate } from "../../src/features/projects/actions/projectCreate.js"
import { projectGrantCreate } from "../../src/features/projects/actions/projectGrantCreate.js"
import { projectLifecycleSet } from "../../src/features/projects/actions/projectLifecycleSet.js"
import { projectRoleCreate } from "../../src/features/projects/actions/projectRoleCreate.js"
import { projectRoleDelete } from "../../src/features/projects/actions/projectRoleDelete.js"
import { projectRepositoryCreate } from "../../src/features/projects/persistence/projectRepositoryCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-account-access-"))
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

async function createRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

async function createActiveUser(database: StorageDatabase, realmId: string, name: string) {
  const created = userCreate({
    context: realmSystemContextCreate(),
    database,
    input: { email: `${name}@example.com`, profile: { displayName: name }, userName: name },
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

test("effective account access is active, deduplicated, resolved, stale-role safe, and cursor stable", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "account-access.example.com")
    const otherRealm = await createRealm(database, "account-access-other.example.com")
    const target = await createActiveUser(database, realm.id, "target")
    const recipient = await createActiveUser(database, realm.id, "recipient")
    const otherTenantUser = await createActiveUser(database, otherRealm.id, "other-tenant")
    const ownerOrganization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Owner", ownerUserId: target.id },
      realmId: realm.id,
    })
    const recipientOrganization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Recipient", ownerUserId: recipient.id },
      realmId: realm.id,
    })
    expect(ownerOrganization.success && recipientOrganization.success).toBe(true)
    if (!ownerOrganization.success || !recipientOrganization.success) return
    const recipientMembership = organizationMembershipCreate({
      context: realmTenantContextCreate(realm.id, recipient.id),
      database,
      input: { roles: ["guest"], userId: target.id },
      organizationId: recipientOrganization.data.organization.id,
      realmId: realm.id,
    })
    expect(recipientMembership.success).toBe(true)
    const project = projectCreate({
      context: realmTenantContextCreate(realm.id, target.id),
      database,
      input: {
        authorizationRequired: true,
        name: "Portal",
        organizationId: ownerOrganization.data.organization.id,
        projectAccessRequired: true,
      },
      realmId: realm.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return
    const role = projectRoleCreate({
      context: realmTenantContextCreate(realm.id, target.id),
      database,
      input: { displayName: "Administrator", key: "admin" },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(role.success).toBe(true)
    if (!role.success) return
    const staleRole = projectRoleCreate({
      context: realmTenantContextCreate(realm.id, target.id),
      database,
      input: { displayName: "Realm administrator", key: "realm_admin" },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(staleRole.success).toBe(true)
    if (!staleRole.success) return
    const deletedStaleRole = projectRoleDelete({
      context: realmTenantContextCreate(realm.id, target.id),
      database,
      projectId: project.data.project.id,
      realmId: realm.id,
      roleId: staleRole.data.role.id,
    })
    expect(deletedStaleRole).toMatchObject({ data: { deleted: true }, success: true })
    const grant = projectGrantCreate({
      context: realmTenantContextCreate(realm.id, target.id),
      database,
      input: { grantedOrganizationId: recipientOrganization.data.organization.id, roleKeys: ["admin"] },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(grant.success).toBe(true)
    if (!grant.success) return
    const corrupted = projectRepositoryCreate(database.db).projectGrantUpdate(grant.data.grant.id, {
      roleKeys: JSON.stringify(["admin", "realm_admin"]),
    })
    expect(corrupted.success).toBe(true)

    const projectAccess = projectAccountAccessList({
      database,
      organizationIds: [recipientOrganization.data.organization.id],
      realmId: realm.id,
    })
    expect(projectAccess.success).toBe(true)
    if (!projectAccess.success) return
    const grantAccess = projectAccess.data.items.find((item) => item.grant?.id === grant.data.grant.id)
    expect(grantAccess?.roleDefinitions.map((role) => role.key)).toEqual(["admin"])
    expect(grantAccess?.roleKeys).toEqual(["admin"])
    expect(grantAccess?.permissions).toEqual(expect.arrayContaining(["project.write"]))
    expect(grantAccess?.permissions).not.toContain("realm.read")

    const firstPage = accountEffectiveAccessList({
      actor: {
        actorId: target.id,
        assurance: "authenticated",
        authenticationMethod: "trusted",
        impersonatorId: "support-admin",
        impersonationPermissions: ["project.read"],
        impersonationSessionId: "support-session",
        kind: "user",
        realmId: realm.id,
      },
      database,
      query: { pageSize: 2 },
      realmId: realm.id,
    })
    expect(firstPage.success).toBe(true)
    if (!firstPage.success) return
    expect(firstPage.data.items).toHaveLength(2)
    expect(firstPage.data.nextPageToken).toBeDefined()
    expect(firstPage.data.items.every((item) => item.organization.organization.realmId === realm.id)).toBe(true)
    expect(firstPage.data.items.flatMap((item) => item.roleKeys)).not.toContain("realm_admin")
    expect(firstPage.data.items.some((item) => item.source === "project-grant")).toBe(false)

    const secondPage = accountEffectiveAccessList({
      actor: {
        actorId: target.id,
        assurance: "authenticated",
        authenticationMethod: "trusted",
        kind: "user",
        realmId: realm.id,
      },
      database,
      query: { pageSize: 2, pageToken: firstPage.data.nextPageToken },
      realmId: realm.id,
    })
    expect(secondPage.success).toBe(true)
    if (!secondPage.success) return
    expect([...firstPage.data.items, ...secondPage.data.items].map((item) => item.id)).toEqual(
      [...new Set([...firstPage.data.items, ...secondPage.data.items].map((item) => item.id))].sort(),
    )
    const grantEntry = [...firstPage.data.items, ...secondPage.data.items].find(
      (item) => item.source === "project-grant",
    )
    expect(grantEntry?.roleKeys).toEqual(expect.arrayContaining(["admin", "guest"]))
    expect(grantEntry?.roleKeys).not.toContain("realm_admin")
    expect(grantEntry?.permissions).toContain("project.write")
    expect(grantEntry?.permissions).not.toContain("realm.read")

    expect(
      accountEffectiveAccessList({
        actor: {
          actorId: otherTenantUser.id,
          assurance: "authenticated",
          authenticationMethod: "trusted",
          kind: "user",
          realmId: otherRealm.id,
        },
        database,
        realmId: realm.id,
      }),
    ).toMatchObject({ code: "account.forbidden", success: false })
    expect(authorizationRoleKeysResolve({ roles: ["owner", "stale-role"] })).toMatchObject({
      data: { permissions: expect.arrayContaining(["project.read"]), roleKeys: ["owner"] },
      success: true,
    })

    const inactive = projectLifecycleSet({
      context: realmTenantContextCreate(realm.id, target.id),
      database,
      input: { status: "inactive" },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(inactive.success).toBe(true)
    const afterInactive = accountEffectiveAccessList({
      actor: {
        actorId: target.id,
        assurance: "authenticated",
        authenticationMethod: "trusted",
        kind: "user",
        realmId: realm.id,
      },
      database,
      realmId: realm.id,
    })
    expect(afterInactive.success).toBe(true)
    if (afterInactive.success) expect(afterInactive.data.items.every((item) => item.project === undefined)).toBe(true)
    expect(recipientMembership.success).toBe(true)
  })
})

test("effective account access uses the impersonated session subject", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "account-impersonation.example.com")
    const impersonator = await createActiveUser(database, realm.id, "impersonator")
    const subject = await createActiveUser(database, realm.id, "subject")
    const impersonatorOrganization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Impersonator organization", ownerUserId: impersonator.id },
      realmId: realm.id,
    })
    const subjectOrganization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Subject organization", ownerUserId: subject.id },
      realmId: realm.id,
    })
    expect(impersonatorOrganization.success && subjectOrganization.success).toBe(true)
    if (!impersonatorOrganization.success || !subjectOrganization.success) return

    const issued = impersonationStart({
      actor: {
        actorId: impersonator.id,
        assurance: "multi_factor",
        authenticationMethod: "trusted",
        kind: "user",
        realmId: realm.id,
      },
      database,
      durationMs: 60_000,
      reason: "Support review",
      realmId: realm.id,
      roles: ["owner"],
      targetUserId: subject.id,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return

    const app = accountServerAppCreate({ database, publicOrigin: "https://account-impersonation.example.com" })
    const response = await app.request(
      `https://account-impersonation.example.com/realms/${realm.id}/me/effective-access`,
      { headers: { authorization: `Bearer ${issued.data.token}` } },
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(
      body.items.map((item: { organization: { organization: { id: string } } }) => item.organization.organization.id),
    ).toEqual([subjectOrganization.data.organization.id])
    expect(
      body.items.map((item: { organization: { organization: { id: string } } }) => item.organization.organization.id),
    ).not.toContain(impersonatorOrganization.data.organization.id)
  })
})

test("the /me effective-access route is authenticated and the GET surface does not require CSRF", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "account-route.example.com")
    const user = await createActiveUser(database, realm.id, "route-user")
    const session = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.id,
      userId: user.id,
    })
    if (!session.success) throw new Error(`${session.op}: ${session.errorMessage}`)
    const app = accountServerAppCreate({ database, publicOrigin: "https://account-route.example.com" })
    const unauthenticated = await app.request(
      `https://account-route.example.com/realms/${realm.id}/me/effective-access`,
    )
    expect(unauthenticated.status).toBe(401)
    const authenticated = await app.request(
      `https://account-route.example.com/realms/${realm.id}/me/effective-access`,
      {
        headers: { authorization: `Bearer ${session.data.token}` },
      },
    )
    expect(authenticated.status).toBe(200)
    const body = await authenticated.json()
    expect(body.items).toEqual([])

    const requests: string[] = []
    const client = accountApiClientCreate({
      baseUrl: "https://account-route.example.com",
      fetch: async (input) => {
        requests.push(String(input))
        return Response.json({ items: [] })
      },
    })
    const result = await client.effectiveAccessList(realm.id, { pageSize: 1 })
    expect(result.success).toBe(true)
    expect(requests[0]).toBe(`https://account-route.example.com/realms/${realm.id}/me/effective-access?pageSize=1`)
  })
})

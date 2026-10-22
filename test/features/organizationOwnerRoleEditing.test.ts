import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationInvitationCreate } from "../../src/features/organizations/actions/organizationInvitationCreate.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { organizationMembershipList } from "../../src/features/organizations/actions/organizationMembershipList.js"
import { organizationMembershipRemove } from "../../src/features/organizations/actions/organizationMembershipRemove.js"
import { organizationMembershipUpdate } from "../../src/features/organizations/actions/organizationMembershipUpdate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-owner-role-editing-"))
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), platformTestkitCreate().runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(opened.errorMessage)
  }
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function createOrganization(database: StorageDatabase, realmId: string, name: string, ownerUserId: string) {
  const created = organizationCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { name, ownerUserId },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.organization
}

test("only owners can grant or revoke the organization owner role", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "owner-editing.example.com", name: "owner-editing.example.com" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const organization = await createOrganization(database, realm.data.realm.id, "Owner Editing", "user-owner")
    const owner = realmTenantContextCreate(realm.data.realm.id, "user-owner")

    const adminAdded = organizationMembershipCreate({
      context: owner,
      database,
      input: { roles: ["admin"], userId: "user-admin" },
      realmId: realm.data.realm.id,
      organizationId: organization.id,
    })
    expect(adminAdded.success).toBe(true)
    if (!adminAdded.success) return
    const admin = realmTenantContextCreate(realm.data.realm.id, "user-admin")

    const memberAdded = organizationMembershipCreate({
      context: owner,
      database,
      input: { roles: ["member"], userId: "user-member" },
      realmId: realm.data.realm.id,
      organizationId: organization.id,
    })
    expect(memberAdded.success).toBe(true)
    if (!memberAdded.success) return

    expect(
      organizationMembershipCreate({
        context: admin,
        database,
        input: { roles: ["owner"], userId: "user-escalated" },
        realmId: realm.data.realm.id,
        organizationId: organization.id,
      }).success,
    ).toBe(false)

    expect(
      organizationMembershipUpdate({
        context: admin,
        database,
        input: { roles: ["owner"] },
        realmId: realm.data.realm.id,
        membershipId: memberAdded.data.membership.id,
        organizationId: organization.id,
      }).success,
    ).toBe(false)

    expect(
      organizationMembershipUpdate({
        context: admin,
        database,
        input: { roles: ["owner"] },
        realmId: realm.data.realm.id,
        membershipId: adminAdded.data.membership.id,
        organizationId: organization.id,
      }).success,
    ).toBe(false)

    expect(
      organizationInvitationCreate({
        context: admin,
        database,
        input: { email: "owner-invite@example.com", roles: ["owner"] },
        realmId: realm.data.realm.id,
        organizationId: organization.id,
      }).success,
    ).toBe(false)

    const secondOwner = organizationMembershipCreate({
      context: owner,
      database,
      input: { roles: ["owner"], userId: "user-second-owner" },
      realmId: realm.data.realm.id,
      organizationId: organization.id,
    })
    expect(secondOwner.success).toBe(true)
    if (!secondOwner.success) return

    const ownerMemberships = organizationMembershipList({
      context: owner,
      database,
      realmId: realm.data.realm.id,
      organizationId: organization.id,
    })
    expect(ownerMemberships.success).toBe(true)
    if (!ownerMemberships.success) return
    const firstOwnerMembership = ownerMemberships.data.items.find((membership) => membership.userId === "user-owner")
    expect(firstOwnerMembership).toBeDefined()
    if (firstOwnerMembership === undefined) return

    expect(
      organizationMembershipUpdate({
        context: admin,
        database,
        input: { roles: ["member"] },
        realmId: realm.data.realm.id,
        membershipId: firstOwnerMembership.id,
        organizationId: organization.id,
      }).success,
    ).toBe(false)

    expect(
      organizationMembershipRemove({
        context: admin,
        database,
        realmId: realm.data.realm.id,
        membershipId: firstOwnerMembership.id,
        organizationId: organization.id,
      }).success,
    ).toBe(false)

    expect(
      organizationInvitationCreate({
        context: owner,
        database,
        input: { email: "owner-invite-2@example.com", roles: ["owner"] },
        realmId: realm.data.realm.id,
        organizationId: organization.id,
      }).success,
    ).toBe(true)
  })
})

test("admins can still manage non-owner organization memberships", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "non-owner-editing.example.com", name: "non-owner-editing.example.com" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const organization = await createOrganization(database, realm.data.realm.id, "Non-owner Editing", "user-owner")
    const owner = realmTenantContextCreate(realm.data.realm.id, "user-owner")

    const adminAdded = organizationMembershipCreate({
      context: owner,
      database,
      input: { roles: ["admin"], userId: "user-admin" },
      realmId: realm.data.realm.id,
      organizationId: organization.id,
    })
    expect(adminAdded.success).toBe(true)
    if (!adminAdded.success) return
    const admin = realmTenantContextCreate(realm.data.realm.id, "user-admin")

    const memberAdded = organizationMembershipCreate({
      context: admin,
      database,
      input: { roles: ["member"], userId: "user-member" },
      realmId: realm.data.realm.id,
      organizationId: organization.id,
    })
    expect(memberAdded.success).toBe(true)
    if (!memberAdded.success) return

    expect(
      organizationMembershipUpdate({
        context: admin,
        database,
        input: { roles: ["admin"] },
        realmId: realm.data.realm.id,
        membershipId: memberAdded.data.membership.id,
        organizationId: organization.id,
      }).success,
    ).toBe(true)

    expect(
      organizationMembershipRemove({
        context: admin,
        database,
        realmId: realm.data.realm.id,
        membershipId: memberAdded.data.membership.id,
        organizationId: organization.id,
      }).success,
    ).toBe(true)
  })
})

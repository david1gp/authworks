import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationInvitationAccept } from "../../src/features/organizations/actions/organizationInvitationAccept.js"
import { organizationInvitationCreate } from "../../src/features/organizations/actions/organizationInvitationCreate.js"
import { organizationInvitationDecline } from "../../src/features/organizations/actions/organizationInvitationDecline.js"
import { organizationInvitationRevoke } from "../../src/features/organizations/actions/organizationInvitationRevoke.js"
import { organizationLifecycleSet } from "../../src/features/organizations/actions/organizationLifecycleSet.js"
import { organizationList } from "../../src/features/organizations/actions/organizationList.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { organizationMembershipList } from "../../src/features/organizations/actions/organizationMembershipList.js"
import { organizationMembershipRemove } from "../../src/features/organizations/actions/organizationMembershipRemove.js"
import { organizationMembershipUpdate } from "../../src/features/organizations/actions/organizationMembershipUpdate.js"
import { organizationSwitch } from "../../src/features/organizations/actions/organizationSwitch.js"
import { organizationUpdate } from "../../src/features/organizations/actions/organizationUpdate.js"
import { organizationApiClientCreate } from "../../src/features/organizations/client/organizationApiClientCreate.js"
import { organizationEventTypes } from "../../src/features/organizations/events/organizationEventTypes.js"
import { organizationServerAppCreate } from "../../src/features/organizations/server/organizationServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-organizations-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "zitadel.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(opened.errorMessage)
  }
  try {
    return await operation(opened.data, testkit)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function createRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

test("organizations, roles, memberships, lifecycle, and switching stay inside an realm", async () => {
  await withDatabase(async (database) => {
    const alpha = await createRealm(database, "alpha.example.com")
    const beta = await createRealm(database, "beta.example.com")
    const system = realmSystemContextCreate("system")
    const created = organizationCreate({
      context: system,
      database,
      input: { name: " Alpha Org ", ownerUserId: "user-alpha" },
      realmId: alpha.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(created.data.organization.name).toBe("Alpha Org")

    const betaOrg = organizationCreate({
      context: system,
      database,
      input: { name: "Beta Org", ownerUserId: "user-beta" },
      realmId: beta.id,
    })
    expect(betaOrg.success).toBe(true)
    if (!betaOrg.success) return

    const owner = realmTenantContextCreate(alpha.id, "user-alpha")
    expect(
      organizationMembershipList({
        context: owner,
        database,
        realmId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(true)
    expect(
      organizationMembershipList({
        context: owner,
        database,
        realmId: beta.id,
        organizationId: betaOrg.data.organization.id,
      }),
    ).toEqual({
      errorMessage: "The memberships are not available in this tenant context.",
      code: "organizations.tenant-mismatch",
      op: "organizationMembershipList",
      success: false,
    })
    expect(
      organizationSwitch({
        context: owner,
        database,
        input: { organizationId: betaOrg.data.organization.id },
        realmId: alpha.id,
      }).success,
    ).toBe(false)

    const added = organizationMembershipCreate({
      context: owner,
      database,
      input: { roles: ["admin"], userId: "user-member" },
      realmId: alpha.id,
      organizationId: created.data.organization.id,
    })
    expect(added.success).toBe(true)
    if (!added.success) return
    expect(
      organizationMembershipUpdate({
        context: owner,
        database,
        input: {} as never,
        realmId: alpha.id,
        membershipId: added.data.membership.id,
        organizationId: created.data.organization.id,
      }),
    ).toMatchObject({ code: "organizations.invalid", success: false })
    expect(
      organizationMembershipCreate({
        context: owner,
        database,
        input: { roles: ["member"], userId: "user-member" },
        realmId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationSwitch({
        context: realmTenantContextCreate(alpha.id, "user-member"),
        database,
        input: { organizationId: created.data.organization.id },
        realmId: alpha.id,
      }).success,
    ).toBe(true)

    const changed = organizationMembershipUpdate({
      context: owner,
      database,
      input: { roles: ["guest"] },
      realmId: alpha.id,
      membershipId: added.data.membership.id,
      organizationId: created.data.organization.id,
    })
    expect(changed.success).toBe(true)
    expect(
      organizationMembershipRemove({
        context: owner,
        database,
        realmId: alpha.id,
        membershipId: added.data.membership.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(true)

    const memberships = organizationMembershipList({
      context: system,
      database,
      realmId: alpha.id,
      organizationId: created.data.organization.id,
    })
    expect(memberships.success).toBe(true)
    if (!memberships.success) return
    const ownerMembership = memberships.data.items.find((membership) => membership.userId === "user-alpha")
    expect(ownerMembership).toBeDefined()
    if (ownerMembership === undefined) return
    const eventCount = database.db.select().from(storageEventTable).all().length
    expect(
      organizationMembershipUpdate({
        context: system,
        database,
        input: { roles: ["member"] },
        realmId: alpha.id,
        membershipId: ownerMembership.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationMembershipRemove({
        context: system,
        database,
        realmId: alpha.id,
        membershipId: ownerMembership.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(false)
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(eventCount)

    const inactive = organizationLifecycleSet({
      context: system,
      database,
      input: { status: "inactive" },
      realmId: alpha.id,
      organizationId: created.data.organization.id,
    })
    expect(inactive.success).toBe(true)
    expect(
      organizationSwitch({
        context: owner,
        database,
        input: { organizationId: created.data.organization.id },
        realmId: alpha.id,
      }).success,
    ).toBe(false)
    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "active" },
        realmId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(true)
    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "removed" },
        realmId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(true)
    const listed = organizationList({ context: system, database, realmId: alpha.id })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.items).toEqual([])
  })
})

test("organization names and lifecycle transitions enforce their preconditions", async () => {
  await withDatabase(async (database) => {
    const alpha = await createRealm(database, "lifecycle-alpha.example.com")
    const beta = await createRealm(database, "lifecycle-beta.example.com")
    const system = realmSystemContextCreate("system")

    expect(
      organizationCreate({
        context: system,
        database,
        input: { name: "   " },
        realmId: alpha.id,
      }).success,
    ).toBe(false)

    const created = organizationCreate({
      context: system,
      database,
      input: { name: "Lifecycle Org" },
      realmId: alpha.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    expect(
      organizationCreate({
        context: system,
        database,
        input: { name: " Lifecycle Org " },
        realmId: alpha.id,
      }).success,
    ).toBe(false)
    expect(
      organizationCreate({
        context: system,
        database,
        input: { name: "Lifecycle Org" },
        realmId: beta.id,
      }).success,
    ).toBe(true)

    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "active" },
        realmId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "inactive" },
        realmId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(true)
    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "inactive" },
        realmId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "active" },
        realmId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(true)
    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "removed" },
        realmId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(true)
    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "active" },
        realmId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "active" },
        realmId: beta.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "inactive" },
        realmId: alpha.id,
        organizationId: "missing-organization",
      }).success,
    ).toBe(false)
  })
})

test("organization lists paginate and PATCH rejects empty input", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "pagination.example.com")
    const context = realmSystemContextCreate("system")
    for (const name of ["First", "Second", "Third"]) {
      expect(organizationCreate({ context, database, input: { name }, realmId: realm.id }).success).toBe(true)
    }
    const first = organizationList({ context, database, realmId: realm.id, query: { pageSize: 2 } })
    expect(first.success).toBe(true)
    if (!first.success || first.data.nextPageToken === undefined) return
    expect(first.data.items).toHaveLength(2)
    const second = organizationList({
      context,
      database,
      realmId: realm.id,
      query: { pageSize: 2, pageToken: first.data.nextPageToken },
    })
    expect(second.success).toBe(true)
    if (!second.success) return
    expect(second.data.items).toHaveLength(1)
    expect(new Set([...first.data.items, ...second.data.items].map((item) => item.id)).size).toBe(3)

    const emptyPatch = organizationUpdate({
      context,
      database,
      input: {},
      realmId: realm.id,
      organizationId: "missing",
    })
    expect(emptyPatch).toMatchObject({ code: "organizations.empty-patch", success: false })
  })
})

test("membership role validation and membership identity stay tenant scoped", async () => {
  await withDatabase(async (database) => {
    const alpha = await createRealm(database, "membership-alpha.example.com")
    const beta = await createRealm(database, "membership-beta.example.com")
    const system = realmSystemContextCreate("system")
    const alphaOrganization = organizationCreate({
      context: system,
      database,
      input: { name: "Alpha Memberships", ownerUserId: "alpha-owner" },
      realmId: alpha.id,
    })
    const betaOrganization = organizationCreate({
      context: system,
      database,
      input: { name: "Beta Memberships" },
      realmId: beta.id,
    })
    expect(alphaOrganization.success).toBe(true)
    expect(betaOrganization.success).toBe(true)
    if (!alphaOrganization.success || !betaOrganization.success) return

    const owner = realmTenantContextCreate(alpha.id, "alpha-owner")
    expect(
      organizationMembershipCreate({
        context: owner,
        database,
        input: { roles: [], userId: "member" },
        realmId: alpha.id,
        organizationId: alphaOrganization.data.organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationMembershipCreate({
        context: owner,
        database,
        input: { roles: ["member", "member"], userId: "member" },
        realmId: alpha.id,
        organizationId: alphaOrganization.data.organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationMembershipCreate({
        context: owner,
        database,
        input: { roles: ["invalid-role" as never], userId: "member" },
        realmId: alpha.id,
        organizationId: alphaOrganization.data.organization.id,
      }).success,
    ).toBe(false)

    const added = organizationMembershipCreate({
      context: owner,
      database,
      input: { roles: ["member"], userId: "member" },
      realmId: alpha.id,
      organizationId: alphaOrganization.data.organization.id,
    })
    expect(added.success).toBe(true)
    if (!added.success) return
    expect(
      organizationMembershipUpdate({
        context: owner,
        database,
        input: { roles: ["admin"] },
        realmId: alpha.id,
        membershipId: added.data.membership.id,
        organizationId: betaOrganization.data.organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationMembershipRemove({
        context: owner,
        database,
        realmId: alpha.id,
        membershipId: added.data.membership.id,
        organizationId: betaOrganization.data.organization.id,
      }).success,
    ).toBe(false)
  })
})

test("invitations are hashed, one-time, atomic, and realm-scoped", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createRealm(database, "invite.example.com")
    const system = realmSystemContextCreate("system")
    const organization = organizationCreate({
      context: system,
      database,
      input: { name: "Invites" },
      realmId: alpha.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const invitation = organizationInvitationCreate({
      context: system,
      database,
      input: { email: "Person@Example.com", roles: ["member"] },
      realmId: alpha.id,
      organizationId: organization.data.organization.id,
    })
    expect(invitation.success).toBe(true)
    if (!invitation.success) return
    expect(invitation.data.token).not.toBe(JSON.stringify(invitation.data.invitation))
    expect(JSON.stringify(database.db.select().from(storageEventTable).all())).not.toContain(invitation.data.token)

    const accepted = organizationInvitationAccept({
      database,
      input: { token: invitation.data.token, userId: "user-accepted" },
    })
    expect(accepted.success).toBe(true)
    expect(
      organizationInvitationAccept({ database, input: { token: invitation.data.token, userId: "user-replay" } })
        .success,
    ).toBe(false)

    const second = organizationInvitationCreate({
      context: system,
      database,
      input: { email: "decline@example.com", roles: ["guest"], expiresAt: 1_700_000_000_100 },
      realmId: alpha.id,
      organizationId: organization.data.organization.id,
    })
    expect(second.success).toBe(true)
    if (!second.success) return
    expect(
      organizationInvitationDecline({ database, input: { token: second.data.token, userId: "user-declined" } }).success,
    ).toBe(true)
    expect(
      organizationInvitationAccept({ database, input: { token: second.data.token, userId: "user-replay" } }).success,
    ).toBe(false)

    const third = organizationInvitationCreate({
      context: system,
      database,
      input: { email: "revoke@example.com", roles: ["member"] },
      realmId: alpha.id,
      organizationId: organization.data.organization.id,
    })
    expect(third.success).toBe(true)
    if (!third.success) return
    expect(
      organizationInvitationRevoke({
        context: system,
        database,
        realmId: alpha.id,
        invitationId: third.data.invitation.id,
        organizationId: organization.data.organization.id,
      }).success,
    ).toBe(true)
    expect(
      organizationInvitationAccept({ database, input: { token: third.data.token, userId: "user-replay" } }).success,
    ).toBe(false)

    const expired = organizationInvitationCreate({
      context: system,
      database,
      input: { email: "expired@example.com", roles: ["member"], expiresAt: 1_700_000_000_010 },
      realmId: alpha.id,
      organizationId: organization.data.organization.id,
    })
    expect(expired.success).toBe(true)
    if (!expired.success) return
    testkit.advance(20)
    expect(
      organizationInvitationAccept({ database, input: { token: expired.data.token, userId: "user-expired" } }).success,
    ).toBe(false)
    expect(JSON.stringify(database.db.select().from(storageEventTable).all())).toContain(
      organizationEventTypes.invitationExpired,
    )
  })
})

test("invitation replacement and acceptance remain organization-scoped", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "invitation-scope.example.com")
    const system = realmSystemContextCreate("system")
    const alpha = organizationCreate({
      context: system,
      database,
      input: { name: "Alpha Invitations", ownerUserId: "existing-user" },
      realmId: realm.id,
    })
    const beta = organizationCreate({
      context: system,
      database,
      input: { name: "Beta Invitations" },
      realmId: realm.id,
    })
    expect(alpha.success).toBe(true)
    expect(beta.success).toBe(true)
    if (!alpha.success || !beta.success) return

    const original = organizationInvitationCreate({
      context: system,
      database,
      input: { email: "Person@Example.com", roles: ["member"] },
      realmId: realm.id,
      organizationId: alpha.data.organization.id,
    })
    expect(original.success).toBe(true)
    if (!original.success) return

    const replacement = organizationInvitationCreate({
      context: system,
      database,
      input: { email: " person@example.com ", roles: ["guest"] },
      realmId: realm.id,
      organizationId: alpha.data.organization.id,
    })
    expect(replacement.success).toBe(true)
    if (!replacement.success) return
    expect(replacement.data.invitation.email).toBe("person@example.com")
    expect(
      organizationInvitationAccept({
        database,
        input: { token: original.data.token, userId: "replay-user" },
      }).success,
    ).toBe(false)

    const accepted = organizationInvitationAccept({
      database,
      input: { token: replacement.data.token, userId: "replacement-user" },
    })
    expect(accepted.success).toBe(true)
    if (!accepted.success) return
    expect(accepted.data.membership.roles).toEqual(["guest"])

    const otherOrganizationInvitation = organizationInvitationCreate({
      context: system,
      database,
      input: { email: "person@example.com", roles: ["member"] },
      realmId: realm.id,
      organizationId: beta.data.organization.id,
    })
    expect(otherOrganizationInvitation.success).toBe(true)
    if (!otherOrganizationInvitation.success) return
    expect(
      organizationInvitationAccept({
        database,
        input: { token: otherOrganizationInvitation.data.token, userId: "other-user" },
      }).success,
    ).toBe(true)
  })
})

test("organization routes and API clients use the same public contracts", async () => {
  await withDatabase(async (database) => {
    const app = organizationServerAppCreate({ database, systemSecret: "system-secret" })
    const realm = await createRealm(database, "api.example.com")
    const client = organizationApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: "system-secret",
    })
    const created = await client.organizationCreate(realm.id, { name: "API org", ownerUserId: "api-user" })
    expect(created.success).toBe(true)
    if (!created.success) return
    const listed = await client.organizationList(realm.id)
    expect(listed.success).toBe(true)
    if (!listed.success) return
    const emptyPatch = await client.organizationUpdate(realm.id, created.data.organization.id, {})
    expect(emptyPatch).toMatchObject({ code: "organizations.empty-patch", success: false })
    const missing = await client.organizationGet(realm.id, "missing-organization")
    expect(missing).toMatchObject({ code: "organizations.not-found", statusCode: 404, success: false })
    const roles = await client.organizationRoleList()
    expect(roles.success).toBe(true)
    if (!roles.success) return
    expect(roles.data.items.map((role) => role.id)).toEqual(["owner", "admin", "member", "guest"])
    const unauthorized = await organizationApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
    }).organizationList(realm.id)
    expect(unauthorized.success).toBe(false)
    const switched = await client.organizationSwitch(realm.id, { organizationId: created.data.organization.id })
    expect(switched.success).toBe(true)
    if (!switched.success) return
    expect(switched.data.context.organizationId).toBe(created.data.organization.id)
  })
})

test("organization CLI commands use the API and do not open SQLite", async () => {
  const helpProcess = Bun.spawn(["bun", "src/outputs/cli.ts", "organizations", "--help"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const helpOutput = await new Response(helpProcess.stdout).text()
  expect(await helpProcess.exited).toBe(0)
  expect(helpOutput).toContain("Organization administration")
})

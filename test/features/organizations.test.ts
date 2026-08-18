import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { instanceCreate } from "../../src/features/instances/actions/instanceCreate.js"
import { instanceSystemContextCreate } from "../../src/features/instances/domain/instanceSystemContextCreate.js"
import { instanceTenantContextCreate } from "../../src/features/instances/domain/instanceTenantContextCreate.js"
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

async function createInstance(database: StorageDatabase, domain: string) {
  const created = instanceCreate({
    context: instanceSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.instance
}

test("organizations, roles, memberships, lifecycle, and switching stay inside an instance", async () => {
  await withDatabase(async (database) => {
    const alpha = await createInstance(database, "alpha.example.com")
    const beta = await createInstance(database, "beta.example.com")
    const system = instanceSystemContextCreate("system")
    const created = organizationCreate({
      context: system,
      database,
      input: { name: " Alpha Org ", ownerUserId: "user-alpha" },
      instanceId: alpha.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(created.data.organization.name).toBe("Alpha Org")

    const betaOrg = organizationCreate({
      context: system,
      database,
      input: { name: "Beta Org", ownerUserId: "user-beta" },
      instanceId: beta.id,
    })
    expect(betaOrg.success).toBe(true)
    if (!betaOrg.success) return

    const owner = instanceTenantContextCreate(alpha.id, "user-alpha")
    expect(
      organizationMembershipList({
        context: owner,
        database,
        instanceId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(true)
    expect(
      organizationMembershipList({
        context: owner,
        database,
        instanceId: beta.id,
        organizationId: betaOrg.data.organization.id,
      }),
    ).toEqual({
      errorMessage: "The memberships are not available in this tenant context.",
      op: "organizationMembershipList",
      success: false,
    })
    expect(
      organizationSwitch({
        context: owner,
        database,
        input: { organizationId: betaOrg.data.organization.id },
        instanceId: alpha.id,
      }).success,
    ).toBe(false)

    const added = organizationMembershipCreate({
      context: owner,
      database,
      input: { roles: ["admin"], userId: "user-member" },
      instanceId: alpha.id,
      organizationId: created.data.organization.id,
    })
    expect(added.success).toBe(true)
    if (!added.success) return
    expect(
      organizationMembershipCreate({
        context: owner,
        database,
        input: { roles: ["member"], userId: "user-member" },
        instanceId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationSwitch({
        context: instanceTenantContextCreate(alpha.id, "user-member"),
        database,
        input: { organizationId: created.data.organization.id },
        instanceId: alpha.id,
      }).success,
    ).toBe(true)

    const changed = organizationMembershipUpdate({
      context: owner,
      database,
      input: { roles: ["guest"] },
      instanceId: alpha.id,
      membershipId: added.data.membership.id,
      organizationId: created.data.organization.id,
    })
    expect(changed.success).toBe(true)
    expect(
      organizationMembershipRemove({
        context: owner,
        database,
        instanceId: alpha.id,
        membershipId: added.data.membership.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(true)

    const memberships = organizationMembershipList({
      context: system,
      database,
      instanceId: alpha.id,
      organizationId: created.data.organization.id,
    })
    expect(memberships.success).toBe(true)
    if (!memberships.success) return
    const ownerMembership = memberships.data.memberships.find((membership) => membership.userId === "user-alpha")
    expect(ownerMembership).toBeDefined()
    if (ownerMembership === undefined) return
    const eventCount = database.db.select().from(storageEventTable).all().length
    expect(
      organizationMembershipUpdate({
        context: system,
        database,
        input: { roles: ["member"] },
        instanceId: alpha.id,
        membershipId: ownerMembership.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationMembershipRemove({
        context: system,
        database,
        instanceId: alpha.id,
        membershipId: ownerMembership.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(false)
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(eventCount)

    const inactive = organizationLifecycleSet({
      context: system,
      database,
      input: { status: "inactive" },
      instanceId: alpha.id,
      organizationId: created.data.organization.id,
    })
    expect(inactive.success).toBe(true)
    expect(
      organizationSwitch({
        context: owner,
        database,
        input: { organizationId: created.data.organization.id },
        instanceId: alpha.id,
      }).success,
    ).toBe(false)
    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "active" },
        instanceId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(true)
    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "removed" },
        instanceId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(true)
    const listed = organizationList({ context: system, database, instanceId: alpha.id })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.organizations).toEqual([])
  })
})

test("organization names and lifecycle transitions enforce their preconditions", async () => {
  await withDatabase(async (database) => {
    const alpha = await createInstance(database, "lifecycle-alpha.example.com")
    const beta = await createInstance(database, "lifecycle-beta.example.com")
    const system = instanceSystemContextCreate("system")

    expect(
      organizationCreate({
        context: system,
        database,
        input: { name: "   " },
        instanceId: alpha.id,
      }).success,
    ).toBe(false)

    const created = organizationCreate({
      context: system,
      database,
      input: { name: "Lifecycle Org" },
      instanceId: alpha.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    expect(
      organizationCreate({
        context: system,
        database,
        input: { name: " Lifecycle Org " },
        instanceId: alpha.id,
      }).success,
    ).toBe(false)
    expect(
      organizationCreate({
        context: system,
        database,
        input: { name: "Lifecycle Org" },
        instanceId: beta.id,
      }).success,
    ).toBe(true)

    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "active" },
        instanceId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "inactive" },
        instanceId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(true)
    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "inactive" },
        instanceId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "active" },
        instanceId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(true)
    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "removed" },
        instanceId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(true)
    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "active" },
        instanceId: alpha.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "active" },
        instanceId: beta.id,
        organizationId: created.data.organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "inactive" },
        instanceId: alpha.id,
        organizationId: "missing-organization",
      }).success,
    ).toBe(false)
  })
})

test("membership role validation and membership identity stay tenant scoped", async () => {
  await withDatabase(async (database) => {
    const alpha = await createInstance(database, "membership-alpha.example.com")
    const beta = await createInstance(database, "membership-beta.example.com")
    const system = instanceSystemContextCreate("system")
    const alphaOrganization = organizationCreate({
      context: system,
      database,
      input: { name: "Alpha Memberships", ownerUserId: "alpha-owner" },
      instanceId: alpha.id,
    })
    const betaOrganization = organizationCreate({
      context: system,
      database,
      input: { name: "Beta Memberships" },
      instanceId: beta.id,
    })
    expect(alphaOrganization.success).toBe(true)
    expect(betaOrganization.success).toBe(true)
    if (!alphaOrganization.success || !betaOrganization.success) return

    const owner = instanceTenantContextCreate(alpha.id, "alpha-owner")
    expect(
      organizationMembershipCreate({
        context: owner,
        database,
        input: { roles: [], userId: "member" },
        instanceId: alpha.id,
        organizationId: alphaOrganization.data.organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationMembershipCreate({
        context: owner,
        database,
        input: { roles: ["member", "member"], userId: "member" },
        instanceId: alpha.id,
        organizationId: alphaOrganization.data.organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationMembershipCreate({
        context: owner,
        database,
        input: { roles: ["invalid-role" as never], userId: "member" },
        instanceId: alpha.id,
        organizationId: alphaOrganization.data.organization.id,
      }).success,
    ).toBe(false)

    const added = organizationMembershipCreate({
      context: owner,
      database,
      input: { roles: ["member"], userId: "member" },
      instanceId: alpha.id,
      organizationId: alphaOrganization.data.organization.id,
    })
    expect(added.success).toBe(true)
    if (!added.success) return
    expect(
      organizationMembershipUpdate({
        context: owner,
        database,
        input: { roles: ["admin"] },
        instanceId: alpha.id,
        membershipId: added.data.membership.id,
        organizationId: betaOrganization.data.organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationMembershipRemove({
        context: owner,
        database,
        instanceId: alpha.id,
        membershipId: added.data.membership.id,
        organizationId: betaOrganization.data.organization.id,
      }).success,
    ).toBe(false)
  })
})

test("invitations are hashed, one-time, atomic, and instance-scoped", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createInstance(database, "invite.example.com")
    const system = instanceSystemContextCreate("system")
    const organization = organizationCreate({
      context: system,
      database,
      input: { name: "Invites" },
      instanceId: alpha.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const invitation = organizationInvitationCreate({
      context: system,
      database,
      input: { email: "Person@Example.com", roles: ["member"] },
      instanceId: alpha.id,
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
      instanceId: alpha.id,
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
      instanceId: alpha.id,
      organizationId: organization.data.organization.id,
    })
    expect(third.success).toBe(true)
    if (!third.success) return
    expect(
      organizationInvitationRevoke({
        context: system,
        database,
        instanceId: alpha.id,
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
      instanceId: alpha.id,
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
    const instance = await createInstance(database, "invitation-scope.example.com")
    const system = instanceSystemContextCreate("system")
    const alpha = organizationCreate({
      context: system,
      database,
      input: { name: "Alpha Invitations", ownerUserId: "existing-user" },
      instanceId: instance.id,
    })
    const beta = organizationCreate({
      context: system,
      database,
      input: { name: "Beta Invitations" },
      instanceId: instance.id,
    })
    expect(alpha.success).toBe(true)
    expect(beta.success).toBe(true)
    if (!alpha.success || !beta.success) return

    const original = organizationInvitationCreate({
      context: system,
      database,
      input: { email: "Person@Example.com", roles: ["member"] },
      instanceId: instance.id,
      organizationId: alpha.data.organization.id,
    })
    expect(original.success).toBe(true)
    if (!original.success) return

    const replacement = organizationInvitationCreate({
      context: system,
      database,
      input: { email: " person@example.com ", roles: ["guest"] },
      instanceId: instance.id,
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
      instanceId: instance.id,
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
    const instance = await createInstance(database, "api.example.com")
    const client = organizationApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: "system-secret",
    })
    const created = await client.organizationCreate(instance.id, { name: "API org", ownerUserId: "api-user" })
    expect(created.success).toBe(true)
    if (!created.success) return
    const listed = await client.organizationList(instance.id)
    expect(listed.success).toBe(true)
    if (!listed.success) return
    const roles = await client.organizationRoleList()
    expect(roles.success).toBe(true)
    if (!roles.success) return
    expect(roles.data.roles.map((role) => role.id)).toEqual(["owner", "admin", "member", "guest"])
    const unauthorized = await organizationApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
    }).organizationList(instance.id)
    expect(unauthorized.success).toBe(false)
    const switched = await client.organizationSwitch(instance.id, { organizationId: created.data.organization.id })
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

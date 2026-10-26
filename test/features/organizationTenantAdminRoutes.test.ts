import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationInvitationAccept } from "../../src/features/organizations/actions/organizationInvitationAccept.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { organizationApiClientCreate } from "../../src/features/organizations/client/organizationApiClientCreate.js"
import type { OrganizationDomainDnsVerificationPort } from "../../src/features/organizations/domain/organizationDomainDnsVerificationPort.js"
import { organizationServerAppCreate } from "../../src/features/organizations/server/organizationServerAppCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

const tenantOrigin = "https://tenant-routes.example.com"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-organization-tenant-routes-"))
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

async function activeUser(database: StorageDatabase, realmId: string, email: string) {
  const system = realmSystemContextCreate("system")
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

async function setupTenantRoutes(database: StorageDatabase, dnsPort: OrganizationDomainDnsVerificationPort) {
  const system = realmSystemContextCreate("system")
  const alpha = realmCreate({
    context: system,
    database,
    input: { domain: "tenant-routes.example.com", name: "Tenant routes" },
  })
  const beta = realmCreate({
    context: system,
    database,
    input: { domain: "tenant-routes-other.example.com", name: "Tenant routes other" },
  })
  expect(alpha.success && beta.success).toBe(true)
  if (!alpha.success || !beta.success) throw new Error("realm setup failed")
  const alphaId = alpha.data.realm.id
  const betaId = beta.data.realm.id

  const ownerA = await activeUser(database, alphaId, "owner-a@tenant-routes.example.com")
  const ownerB = await activeUser(database, alphaId, "owner-b@tenant-routes.example.com")
  const member = await activeUser(database, alphaId, "member@tenant-routes.example.com")
  const outsider = await activeUser(database, alphaId, "outsider@tenant-routes.example.com")

  const orgA = organizationCreate({
    context: system,
    database,
    input: { name: "Tenant A", ownerUserId: ownerA.id },
    realmId: alphaId,
  })
  const orgB = organizationCreate({
    context: system,
    database,
    input: { name: "Tenant B", ownerUserId: ownerB.id },
    realmId: alphaId,
  })
  expect(orgA.success && orgB.success).toBe(true)
  if (!orgA.success || !orgB.success) throw new Error("organization setup failed")
  const orgAId = orgA.data.organization.id
  const orgBId = orgB.data.organization.id
  const seeded = organizationMembershipCreate({
    context: realmTenantContextCreate(alphaId, ownerA.id),
    database,
    input: { roles: ["member"], userId: member.id },
    organizationId: orgAId,
    realmId: alphaId,
  })
  expect(seeded.success).toBe(true)
  if (!seeded.success) throw new Error(seeded.errorMessage)

  const app = organizationServerAppCreate({
    database,
    domainVerificationPort: dnsPort,
    publicOrigin: tenantOrigin,
  })
  const clientFor = (userId: string) => {
    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: alphaId,
      userId,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) throw new Error(issued.errorMessage)
    const csrf = sessionCsrfTokenCreate(database.runtime)
    return organizationApiClientCreate({
      baseUrl: tenantOrigin,
      csrfToken: csrf,
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers)
        headers.set("cookie", `session=${issued.data.token}; csrf=${csrf}`)
        headers.set("origin", tenantOrigin)
        return app.request(input.toString(), { ...init, headers })
      },
    })
  }
  return {
    alphaId,
    app,
    betaId,
    clientFor,
    member,
    orgAId,
    orgBId,
    outsider,
    ownerA,
    ownerB,
  }
}

test("tenant domain verification succeeds for the owning org admin and denies cross-org callers", async () => {
  await withDatabase(async (database) => {
    let dnsRecords: readonly string[] = []
    const dnsPort: OrganizationDomainDnsVerificationPort = {
      txtRecordsGet: async () => resultCreate(dnsRecords),
    }
    const fixtures = setupTenantRoutes(database, dnsPort)
    const { alphaId, betaId, clientFor, member, orgAId, outsider, ownerA, ownerB } = await fixtures
    const adminA = clientFor(ownerA.id)
    const adminB = clientFor(ownerB.id)
    const memberA = clientFor(member.id)
    const stranger = clientFor(outsider.id)

    const claim = await adminA.organizationTenantDomainClaim(alphaId, orgAId, { domain: "verify-a.example.com" })
    expect(claim.success).toBe(true)
    if (!claim.success) return
    dnsRecords = [claim.data.domain.verification?.recordValue ?? ""]
    const verified = await adminA.organizationTenantDomainVerify(alphaId, orgAId, "verify-a.example.com")
    expect(verified).toMatchObject({ data: { domain: { verified: true } }, success: true })

    const pending = await adminA.organizationTenantDomainClaim(alphaId, orgAId, { domain: "other-a.example.com" })
    expect(pending.success).toBe(true)
    if (!pending.success) return
    expect(await memberA.organizationTenantDomainVerify(alphaId, orgAId, "other-a.example.com")).toMatchObject({
      code: "authorization.forbidden",
      success: false,
    })
    expect(await adminB.organizationTenantDomainVerify(alphaId, orgAId, "other-a.example.com")).toMatchObject({
      code: "platform.unauthorized",
      success: false,
    })
    expect(await stranger.organizationTenantDomainVerify(alphaId, orgAId, "other-a.example.com")).toMatchObject({
      code: "platform.unauthorized",
      success: false,
    })

    const crossRealm = await adminA.organizationTenantDomainVerify(betaId, orgAId, "verify-a.example.com")
    expect(crossRealm).toMatchObject({ code: "platform.unauthorized", success: false })
    const neighbor = await adminA.organizationTenantDomainList(betaId, orgAId)
    expect(neighbor).toMatchObject({ code: "platform.unauthorized", success: false })
  })
})

test("tenant membership update and removal succeed for the org admin and deny other callers", async () => {
  await withDatabase(async (database) => {
    const dnsPort: OrganizationDomainDnsVerificationPort = {
      txtRecordsGet: async () => resultCreate([]),
    }
    const { alphaId, clientFor, orgAId, outsider, ownerA, ownerB } = await setupTenantRoutes(database, dnsPort)
    const adminA = clientFor(ownerA.id)
    const adminB = clientFor(ownerB.id)
    const stranger = clientFor(outsider.id)
    const rotating = await activeUser(database, alphaId, "rotating@tenant-routes.example.com")

    const created = await adminA.organizationTenantMembershipCreate(alphaId, orgAId, {
      roles: ["member"],
      userId: rotating.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const membershipId = created.data.membership.id
    const memberClient = clientFor(rotating.id)

    expect(
      await memberClient.organizationTenantMembershipUpdate(alphaId, orgAId, membershipId, { roles: ["admin"] }),
    ).toMatchObject({ code: "authorization.forbidden", success: false })
    expect(
      await stranger.organizationTenantMembershipUpdate(alphaId, orgAId, membershipId, { roles: ["member"] }),
    ).toMatchObject({ code: "platform.unauthorized", success: false })
    expect(
      await adminB.organizationTenantMembershipUpdate(alphaId, orgAId, membershipId, { roles: ["member"] }),
    ).toMatchObject({ code: "platform.unauthorized", success: false })

    const updated = await adminA.organizationTenantMembershipUpdate(alphaId, orgAId, membershipId, {
      roles: ["admin"],
    })
    expect(updated).toMatchObject({ data: { membership: { roles: ["admin"] } }, success: true })

    const removed = await adminA.organizationTenantMembershipRemove(alphaId, orgAId, membershipId)
    expect(removed).toMatchObject({ success: true })
    expect((await adminA.organizationTenantMembershipRemove(alphaId, orgAId, membershipId)).success).toBe(false)
  })
})

test("tenant invitation revocation blocks later acceptance", async () => {
  await withDatabase(async (database) => {
    const dnsPort: OrganizationDomainDnsVerificationPort = {
      txtRecordsGet: async () => resultCreate([]),
    }
    const { alphaId, clientFor, orgAId, outsider, ownerA } = await setupTenantRoutes(database, dnsPort)
    const adminA = clientFor(ownerA.id)
    const stranger = clientFor(outsider.id)
    const invitee = await activeUser(database, alphaId, "invitee@tenant-routes.example.com")

    const created = await adminA.organizationTenantInvitationCreate(alphaId, orgAId, {
      email: invitee.email,
      roles: ["member"],
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const revoked = await adminA.organizationTenantInvitationRevoke(alphaId, orgAId, created.data.invitation.id)
    expect(revoked).toMatchObject({ data: { revoked: true }, success: true })
    expect(
      organizationInvitationAccept({ database, input: { token: created.data.token, userId: invitee.id } }),
    ).toMatchObject({ code: "organizations.pending", success: false })

    const pending = await adminA.organizationTenantInvitationCreate(alphaId, orgAId, {
      email: "pending@tenant-routes.example.com",
      roles: ["member"],
    })
    expect(pending.success).toBe(true)
    if (!pending.success) return
    expect(
      await stranger.organizationTenantInvitationRevoke(alphaId, orgAId, pending.data.invitation.id),
    ).toMatchObject({ code: "platform.unauthorized", success: false })
  })
})

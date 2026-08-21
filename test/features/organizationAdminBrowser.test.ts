import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationApiClientCreate } from "../../src/features/organizations/client/organizationApiClientCreate.js"
import { organizationBrandingDefaultCreate } from "../../src/features/organizations/domain/organizationBrandingDefaultCreate.js"
import { organizationServerAppCreate } from "../../src/features/organizations/server/organizationServerAppCreate.js"
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
  const directory = await mkdtemp(join(tmpdir(), "authworks-organization-admin-browser-"))
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

test("browser realm administrator organization routes use session boundaries, pagination, CSRF, and redaction", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const alpha = realmCreate({
      context: system,
      database,
      input: { domain: "admin-alpha.example.com", name: "Alpha" },
    })
    const beta = realmCreate({
      context: system,
      database,
      input: { domain: "admin-beta.example.com", name: "Beta" },
    })
    expect(alpha.success && beta.success).toBe(true)
    if (!alpha.success || !beta.success) return

    const bootstrap = realmBootstrapAdminCreate({ context: system, database, realmId: alpha.data.realm.id })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return
    const first = organizationCreate({
      context: system,
      database,
      input: { name: "First" },
      realmId: alpha.data.realm.id,
    })
    const second = organizationCreate({
      context: system,
      database,
      input: { name: "Second" },
      realmId: alpha.data.realm.id,
    })
    expect(first.success && second.success).toBe(true)
    if (!first.success || !second.success) return

    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "bootstrap_admin",
      database,
      realmId: alpha.data.realm.id,
      subjectId: bootstrap.data.bootstrapAdmin.adminId,
      subjectType: "bootstrap_admin",
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return
    const csrf = sessionCsrfTokenCreate(database.runtime)
    const app = organizationServerAppCreate({ database, publicOrigin: "https://admin-alpha.example.com" })
    const client = organizationApiClientCreate({
      baseUrl: "https://admin-alpha.example.com",
      csrfToken: csrf,
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers)
        headers.set("cookie", `session=${issued.data.token}; csrf=${csrf}`)
        headers.set("origin", "https://admin-alpha.example.com")
        return app.request(input.toString(), { ...init, headers })
      },
    })

    const page = await client.organizationTenantList(alpha.data.realm.id, { pageSize: 1 })
    expect(page).toMatchObject({ success: true, data: { items: [{ name: "First" }] } })
    expect(page.success && page.data.nextPageToken).toBeDefined()
    if (!page.success || page.data.nextPageToken === undefined) return
    const next = await client.organizationTenantList(alpha.data.realm.id, {
      pageSize: 1,
      pageToken: page.data.nextPageToken,
    })
    expect(next).toMatchObject({ success: true, data: { items: [{ name: "Second" }] } })

    const created = await client.organizationTenantCreate(alpha.data.realm.id, { name: "Managed" })
    expect(created).toMatchObject({ success: true, data: { organization: { name: "Managed" } } })
    if (!created.success) return
    const organizationId = created.data.organization.id
    expect((await client.organizationTenantGet(alpha.data.realm.id, organizationId)).success).toBe(true)
    expect((await client.organizationTenantRoleList(alpha.data.realm.id)).success).toBe(true)
    expect(
      (
        await client.organizationTenantBrandingSet(
          alpha.data.realm.id,
          organizationId,
          organizationBrandingDefaultCreate(),
        )
      ).success,
    ).toBe(true)
    expect(
      (await client.organizationTenantLoginPolicySet(alpha.data.realm.id, organizationId, { allowPassword: false }))
        .success,
    ).toBe(true)

    const membership = await client.organizationTenantMembershipCreate(alpha.data.realm.id, organizationId, {
      roles: ["member"],
      userId: "managed-user",
    })
    expect(membership.success).toBe(true)
    expect(
      (await client.organizationTenantMembershipList(alpha.data.realm.id, organizationId, { pageSize: 1 })).success,
    ).toBe(true)

    const invitation = await client.organizationTenantInvitationCreate(alpha.data.realm.id, organizationId, {
      email: "invite@example.com",
      roles: ["guest"],
    })
    expect(invitation.success).toBe(true)
    if (!invitation.success) return
    expect(invitation.data.token).toBeString()
    const invitations = await client.organizationTenantInvitationList(alpha.data.realm.id, organizationId)
    expect(invitations.success).toBe(true)
    expect(JSON.stringify(invitations)).not.toContain(invitation.data.token)

    const domain = await client.organizationTenantDomainClaim(alpha.data.realm.id, organizationId, {
      domain: "managed.example.com",
    })
    expect(domain.success).toBe(true)
    if (!domain.success) return
    const domains = await client.organizationTenantDomainList(alpha.data.realm.id, organizationId)
    expect(domains.success).toBe(true)
    const verificationValue = domain.data.domain.verification?.recordValue
    expect(typeof verificationValue).toBe("string")
    if (verificationValue !== undefined) expect(JSON.stringify(domains)).not.toContain(verificationValue)

    const missingOrigin = await app.request(
      `https://admin-alpha.example.com/realms/${alpha.data.realm.id}/organizations/${organizationId}/lifecycle`,
      {
        body: JSON.stringify({ status: "inactive" }),
        headers: { cookie: `session=${issued.data.token}; csrf=${csrf}`, "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(missingOrigin.status).toBe(403)
    const invalidCsrf = await app.request(
      `https://admin-alpha.example.com/realms/${alpha.data.realm.id}/organizations/${organizationId}/lifecycle`,
      {
        body: JSON.stringify({ status: "inactive" }),
        headers: {
          cookie: `session=${issued.data.token}; csrf=${csrf}`,
          "content-type": "application/json",
          origin: "https://admin-alpha.example.com",
          "x-csrf-token": "invalid",
        },
        method: "POST",
      },
    )
    expect(invalidCsrf.status).toBe(403)
    const crossRealm = await app.request(`https://admin-alpha.example.com/realms/${beta.data.realm.id}/organizations`, {
      headers: { cookie: `session=${issued.data.token}` },
    })
    expect(crossRealm.status).toBe(401)
  })
})

test("browser organization administration denies a user outside the organization", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const realm = realmCreate({
      context: system,
      database,
      input: { domain: "member-admin.example.com", name: "Member realm" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const user = await activeUser(database, realm.data.realm.id, "member@example.com")
    const organization = organizationCreate({
      context: system,
      database,
      input: { name: "Private organization" },
      realmId: realm.data.realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.data.realm.id,
      userId: user.id,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return
    const app = organizationServerAppCreate({ database })
    const response = await app.request(
      `https://member-admin.example.com/realms/${realm.data.realm.id}/organizations/${organization.data.organization.id}`,
      { headers: { authorization: `Bearer ${issued.data.token}` } },
    )
    expect(response.status).toBe(403)
  })
})

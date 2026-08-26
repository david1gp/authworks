import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { machineCredentialAuthenticate } from "../../src/features/machineUsers/actions/machineCredentialAuthenticate.js"
import { machineUserCreate } from "../../src/features/machineUsers/actions/machineUserCreate.js"
import { machineUserApiClientCreate } from "../../src/features/machineUsers/client/machineUserApiClientCreate.js"
import { machineUserServerAppCreate } from "../../src/features/machineUsers/server/machineUserServerAppCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
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

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-machine-users-browser-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data, testkit)
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

async function createActiveUser(database: StorageDatabase, realmId: string, userName: string) {
  const created = userCreate({
    context: realmSystemContextCreate(),
    database,
    input: { email: `${userName}@example.com`, profile: { displayName: userName }, userName },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const active = userLifecycleSet({
    context: realmSystemContextCreate(),
    database,
    input: { state: "active" },
    realmId,
    userId: created.data.user.id,
  })
  expect(active.success).toBe(true)
  if (!active.success) throw new Error(active.errorMessage)
  return created.data.user
}

async function browserClient(
  app: ReturnType<typeof machineUserServerAppCreate>,
  origin: string,
  token: string,
  csrfToken: string,
) {
  return machineUserApiClientCreate({
    baseUrl: origin,
    csrfToken,
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers)
      headers.set("cookie", `session=${token}; csrf=${csrfToken}`)
      headers.set("origin", origin)
      return app.request(input.toString(), { ...init, headers })
    },
  })
}

test("browser realm administrator machine-user routes enforce sessions, permissions, step-up, pagination, and redaction", async () => {
  await withDatabase(async (database, testkit) => {
    const system = realmSystemContextCreate()
    const alpha = await createRealm(database, "machine-browser-alpha.example.com")
    const beta = await createRealm(database, "machine-browser-beta.example.com")
    const bootstrap = realmBootstrapAdminCreate({ context: system, database, realmId: alpha.id })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return

    const first = machineUserCreate({
      context: system,
      database,
      input: { displayName: "First", userName: "first", scopes: ["api.read"] },
      realmId: alpha.id,
    })
    const second = machineUserCreate({
      context: system,
      database,
      input: { displayName: "Second", userName: "second", scopes: ["api.read", "api.write"] },
      realmId: alpha.id,
    })
    expect(first.success && second.success).toBe(true)
    if (!first.success || !second.success) return

    const bootstrapSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "bootstrap_admin",
      database,
      realmId: alpha.id,
      runtime: database.runtime,
      subjectId: bootstrap.data.bootstrapAdmin.adminId,
      subjectType: "bootstrap_admin",
    })
    expect(bootstrapSession.success).toBe(true)
    if (!bootstrapSession.success) return
    const app = machineUserServerAppCreate({
      database,
      publicOrigin: `https://${alpha.domain}`,
      systemSecret: "system-secret",
    })
    const bootstrapClient = await browserClient(
      app,
      `https://${alpha.domain}`,
      bootstrapSession.data.token,
      sessionCsrfTokenCreate(database.runtime),
    )

    const firstPage = await bootstrapClient.machineUserTenantList(alpha.id, { pageSize: 1 })
    expect(firstPage).toMatchObject({ success: true, data: { items: [{ userName: "second" }] } })
    expect(firstPage.success && firstPage.data.nextPageToken).toBeString()
    expect((await bootstrapClient.machineUserTenantGet(alpha.id, first.data.machineUser.id)).success).toBe(true)
    expect((await bootstrapClient.machineUserTenantList(beta.id)).success).toBe(false)
    if (!firstPage.success || firstPage.data.nextPageToken === undefined) return
    const secondPage = await bootstrapClient.machineUserTenantList(alpha.id, {
      pageSize: 1,
      pageToken: firstPage.data.nextPageToken,
    })
    expect(secondPage).toMatchObject({ success: true, data: { items: [{ userName: "first" }] } })

    const admin = await createActiveUser(database, alpha.id, "machine-admin")
    const organization = organizationCreate({
      context: system,
      database,
      input: { name: "Machine administrators" },
      realmId: alpha.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const membership = organizationMembershipCreate({
      context: system,
      database,
      input: { roles: ["admin"], userId: admin.id },
      organizationId: organization.data.organization.id,
      realmId: alpha.id,
    })
    expect(membership.success).toBe(true)

    const adminSession = sessionIssue({
      assurance: "multi_factor",
      authenticationMethod: "password",
      database,
      mfaMethod: "totp",
      realmId: alpha.id,
      runtime: database.runtime,
      subjectId: admin.id,
      userId: admin.id,
    })
    if (!adminSession.success) throw new Error(adminSession.errorMessage)
    expect(adminSession.success).toBe(true)
    const adminCsrf = sessionCsrfTokenCreate(database.runtime)
    const adminClient = await browserClient(app, `https://${alpha.domain}`, adminSession.data.token, adminCsrf)

    const created = await adminClient.machineUserTenantCreate(alpha.id, {
      displayName: "Browser worker",
      scopes: ["api.read", "api.write"],
      userName: "browser-worker",
    })
    if (!created.success) throw new Error(created.errorMessage)
    expect(created.success).toBe(true)
    if (!created.success) return
    const clientSecret = created.data.clientSecret
    expect(clientSecret).toBeString()
    expect(JSON.stringify(await adminClient.machineUserTenantGet(alpha.id, created.data.machineUser.id))).not.toContain(
      clientSecret,
    )

    const credentials = await adminClient.machineUserTenantCredentialList(alpha.id, created.data.machineUser.id)
    expect(credentials.success).toBe(true)
    expect(JSON.stringify(credentials)).not.toContain(clientSecret)

    const personalAccessToken = await adminClient.machineUserTenantPersonalAccessTokenCreate(
      alpha.id,
      created.data.machineUser.id,
      {
        expiresAt: database.runtime.now() + 1_000,
        machineUserId: created.data.machineUser.id,
        name: "browser-pat",
        scopes: ["api.read"],
      },
    )
    expect(personalAccessToken.success).toBe(true)
    if (!personalAccessToken.success) return
    expect(
      machineCredentialAuthenticate({
        database,
        realmId: alpha.id,
        token: personalAccessToken.data.secret,
      }).success,
    ).toBe(true)
    testkit.advance(1_001)
    expect(
      machineCredentialAuthenticate({
        database,
        realmId: alpha.id,
        token: personalAccessToken.data.secret,
      }).success,
    ).toBe(false)
    expect(
      JSON.stringify(await adminClient.machineUserTenantCredentialList(alpha.id, created.data.machineUser.id)),
    ).not.toContain(personalAccessToken.data.secret)

    const apiKey = await adminClient.machineUserTenantApiKeyCreate(alpha.id, created.data.machineUser.id, {
      machineUserId: created.data.machineUser.id,
      name: "browser-key",
      scopes: ["api.write"],
    })
    expect(apiKey.success).toBe(true)
    if (!apiKey.success) return
    const revoked = await adminClient.machineUserTenantCredentialRevoke(alpha.id, apiKey.data.credential.id, {
      reason: "test revoke",
    })
    expect(revoked.success).toBe(true)
    expect(JSON.stringify(revoked)).not.toContain(apiKey.data.secret)

    const rotated = await adminClient.machineUserTenantClientSecretRotate(alpha.id, created.data.machineUser.id)
    expect(rotated.success).toBe(true)
    if (!rotated.success) return
    expect(rotated.data.clientSecret).not.toBe(clientSecret)
    expect(JSON.stringify(await adminClient.machineUserTenantGet(alpha.id, created.data.machineUser.id))).not.toContain(
      rotated.data.clientSecret,
    )
    expect(
      JSON.stringify(await adminClient.machineUserTenantCredentialList(alpha.id, created.data.machineUser.id)),
    ).not.toContain(rotated.data.clientSecret)
    const invalidCsrf = await app.request(
      `https://${alpha.domain}/realms/${alpha.id}/machine-users/${created.data.machineUser.id}/lifecycle`,
      {
        body: JSON.stringify({ status: "active" }),
        headers: {
          cookie: `session=${adminSession.data.token}; csrf=${adminCsrf}`,
          "content-type": "application/json",
          origin: `https://${alpha.domain}`,
          "x-csrf-token": "invalid",
        },
        method: "POST",
      },
    )
    expect(invalidCsrf.status).toBe(403)
    expect(
      (await adminClient.machineUserTenantLifecycleSet(alpha.id, created.data.machineUser.id, { status: "inactive" }))
        .success,
    ).toBe(true)

    const noStepUp = await app.request(`https://${alpha.domain}/realms/${alpha.id}/machine-users`, {
      body: JSON.stringify({ displayName: "Denied", userName: "denied" }),
      headers: {
        cookie: `session=${bootstrapSession.data.token}; csrf=${adminCsrf}`,
        "content-type": "application/json",
        origin: `https://${alpha.domain}`,
        "x-csrf-token": adminCsrf,
      },
      method: "POST",
    })
    expect(noStepUp.status).toBe(403)

    const missingOrigin = await app.request(`https://${alpha.domain}/realms/${alpha.id}/machine-users`, {
      body: JSON.stringify({ displayName: "Denied", userName: "denied-origin" }),
      headers: {
        cookie: `session=${adminSession.data.token}; csrf=${adminCsrf}`,
        "content-type": "application/json",
        "x-csrf-token": adminCsrf,
      },
      method: "POST",
    })
    expect(missingOrigin.status).toBe(403)
  })
})

test("browser machine-user routes deny non-administrators and expired sessions without exposing secrets", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "machine-browser-denial.example.com")
    const user = await createActiveUser(database, realm.id, "machine-member")
    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Members" },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const membership = organizationMembershipCreate({
      context: realmSystemContextCreate(),
      database,
      input: { roles: ["member"], userId: user.id },
      organizationId: organization.data.organization.id,
      realmId: realm.id,
    })
    expect(membership.success).toBe(true)
    const session = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.id,
      runtime: database.runtime,
      subjectId: user.id,
      userId: user.id,
      expiresAt: database.runtime.now() + 100,
    })
    if (!session.success) throw new Error(session.errorMessage)
    expect(session.success).toBe(true)
    const app = machineUserServerAppCreate({ database, publicOrigin: `https://${realm.domain}` })
    const csrf = sessionCsrfTokenCreate(database.runtime)
    const denied = await app.request(`https://${realm.domain}/realms/${realm.id}/machine-users`, {
      headers: { cookie: `session=${session.data.token}; csrf=${csrf}` },
    })
    expect(denied.status).toBe(403)
    testkit.advance(101)
    const expired = await app.request(`https://${realm.domain}/realms/${realm.id}/machine-users`, {
      headers: { cookie: `session=${session.data.token}; csrf=${csrf}` },
    })
    expect(expired.status).toBe(401)
  })
})

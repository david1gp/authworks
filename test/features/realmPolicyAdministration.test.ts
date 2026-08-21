import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Hono } from "hono"
import { externalIdentityServerAppCreate } from "../../src/features/externalIdentities/server/externalIdentityServerAppCreate.js"
import { mfaServerAppCreate } from "../../src/features/mfa/server/mfaServerAppCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { passwordServerAppCreate } from "../../src/features/passwords/server/passwordServerAppCreate.js"
import { realmBootstrapAdminCreate } from "../../src/features/realms/actions/realmBootstrapAdminCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionServerAppCreate } from "../../src/features/sessions/server/sessionServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-realm-policy-admin-"))
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

async function realmCreateForTest(database: StorageDatabase, domain: string) {
  const created = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

async function userCreateForTest(database: StorageDatabase, realmId: string, userName: string) {
  const context = realmTenantContextCreate(realmId, "anonymous")
  let token = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: `${userName}@example.com`,
      password: "Correct Horse 12",
      profile: { displayName: userName },
      userName,
    },
    onVerificationToken: (delivery) => {
      token = delivery.token
    },
    realmId,
  })
  expect(registered.success).toBe(true)
  const verified = passwordEmailVerify({ context, database, input: { token }, realmId })
  expect(verified.success).toBe(true)
  if (!verified.success) throw new Error(verified.errorMessage)
  return verified.data.user.id
}

function sessionCookieGet(response: Response): string {
  const cookie = response.headers.get("set-cookie") ?? ""
  const token = /^session=([^;]+)/.exec(cookie)?.[1]
  if (token === undefined) throw new Error("The browser session cookie was not issued.")
  return token
}

test("realm policy and provider administration is session-bound, permissioned, stepped up, and secret-safe", async () => {
  await withDatabase(async (database) => {
    const alpha = await realmCreateForTest(database, "realm-policy-admin.example.com")
    const beta = await realmCreateForTest(database, "realm-policy-other.example.com")
    const bootstrap = realmBootstrapAdminCreate({ context: realmSystemContextCreate(), database, realmId: alpha.id })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return

    const app = new Hono()
    app.route("/", sessionServerAppCreate({ database, publicOrigin: "https://realm-policy-admin.example.com" }))
    app.route("/", passwordServerAppCreate({ database, publicOrigin: "https://realm-policy-admin.example.com" }))
    app.route("/", mfaServerAppCreate({ database, publicOrigin: "https://realm-policy-admin.example.com" }))
    app.route(
      "/",
      externalIdentityServerAppCreate({ database, publicOrigin: "https://realm-policy-admin.example.com" }),
    )

    const bootstrapSignIn = await app.request(
      `https://realm-policy-admin.example.com/realms/${alpha.id}/admin/sign-in`,
      {
        body: JSON.stringify({ secret: bootstrap.data.bootstrapAdmin.secret.valueGet() }),
        headers: {
          "content-type": "application/json",
          origin: "https://realm-policy-admin.example.com",
        },
        method: "POST",
      },
    )
    expect(bootstrapSignIn.status).toBe(200)
    const bootstrapToken = sessionCookieGet(bootstrapSignIn)
    const bootstrapHeaders = { cookie: `session=${bootstrapToken}` }

    for (const path of ["password-policy", "mfa-policy"]) {
      const response = await app.request(`https://realm-policy-admin.example.com/realms/${alpha.id}/${path}`, {
        headers: { ...bootstrapHeaders, host: "realm-policy-admin.example.com" },
      })
      expect(response.status).toBe(200)
    }
    const csrf = await app.request(`https://realm-policy-admin.example.com/realms/${alpha.id}/sessions/csrf`, {
      headers: { ...bootstrapHeaders, host: "realm-policy-admin.example.com" },
    })
    const csrfToken = ((await csrf.json()) as { csrfToken: string }).csrfToken
    const missingCsrf = await app.request(`https://realm-policy-admin.example.com/realms/${alpha.id}/password-policy`, {
      body: JSON.stringify({
        lockoutDurationMs: 900_000,
        maximumAttempts: 5,
        minimumLength: 12,
        requireLowercase: false,
        requireNumber: false,
        requireSymbol: false,
        requireUppercase: false,
      }),
      headers: {
        ...bootstrapHeaders,
        host: "realm-policy-admin.example.com",
        origin: "https://realm-policy-admin.example.com",
      },
      method: "PATCH",
    })
    expect(missingCsrf.status).toBe(403)
    const systemPath = await app.request(
      `https://realm-policy-admin.example.com/system/realms/${alpha.id}/mfa-policy`,
      {
        headers: bootstrapHeaders,
      },
    )
    expect(systemPath.status).toBe(401)
    const crossRealm = await app.request(`https://realm-policy-admin.example.com/realms/${beta.id}/password-policy`, {
      headers: bootstrapHeaders,
    })
    expect(crossRealm.status).toBe(401)

    const deniedUserId = await userCreateForTest(database, alpha.id, "denied-admin")
    const deniedSession = sessionIssue({
      assurance: "multi_factor",
      authenticationMethod: "password",
      database,
      mfaMethod: "totp",
      realmId: alpha.id,
      subjectId: deniedUserId,
      userId: deniedUserId,
    })
    expect(deniedSession.success).toBe(true)
    if (!deniedSession.success) return
    const denied = await app.request(`https://realm-policy-admin.example.com/realms/${alpha.id}/password-policy`, {
      headers: { authorization: `Bearer ${deniedSession.data.token}` },
    })
    expect(denied.status).toBe(403)

    const adminUserId = await userCreateForTest(database, alpha.id, "realm-admin")
    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Realm administrators", ownerUserId: adminUserId },
      realmId: alpha.id,
    })
    expect(organization.success).toBe(true)
    const authenticatedAdminSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: alpha.id,
      subjectId: adminUserId,
      userId: adminUserId,
    })
    expect(authenticatedAdminSession.success).toBe(true)
    if (!authenticatedAdminSession.success) return
    const withoutStepUp = await app.request(`https://realm-policy-admin.example.com/realms/${alpha.id}/mfa-policy`, {
      body: JSON.stringify({ lockoutDurationMs: 900_000, maxAttempts: 3, mode: "required", totpWindow: 1 }),
      headers: {
        authorization: `Bearer ${authenticatedAdminSession.data.token}`,
        "content-type": "application/json",
      },
      method: "PATCH",
    })
    expect(withoutStepUp.status).toBe(403)
    const adminSession = sessionIssue({
      assurance: "multi_factor",
      authenticationMethod: "password",
      database,
      mfaMethod: "totp",
      realmId: alpha.id,
      subjectId: adminUserId,
      userId: adminUserId,
    })
    expect(adminSession.success).toBe(true)
    if (!adminSession.success) return
    const adminHeaders = { authorization: `Bearer ${adminSession.data.token}` }
    const policyUpdate = await app.request(`https://realm-policy-admin.example.com/realms/${alpha.id}/mfa-policy`, {
      body: JSON.stringify({ lockoutDurationMs: 900_000, maxAttempts: 3, mode: "required", totpWindow: 1 }),
      headers: { ...adminHeaders, "content-type": "application/json" },
      method: "PATCH",
    })
    expect(policyUpdate.status).toBe(200)

    for (const [type, displayName] of [
      ["google", "Google"],
      ["github", "GitHub"],
      ["microsoft", "Microsoft"],
    ] as const) {
      const created = await app.request(
        `https://realm-policy-admin.example.com/realms/${alpha.id}/external-identity-providers`,
        {
          body: JSON.stringify({
            allowAccountCreation: true,
            clientId: `${type}-client`,
            clientSecret: `${type}-secret`,
            displayName,
            redirectUri: "https://app.example.com/callback",
            type,
          }),
          headers: { ...adminHeaders, "content-type": "application/json" },
          method: "POST",
        },
      )
      expect(created.status).toBe(201)
      expect(await created.text()).not.toContain(`${type}-secret`)
    }
    const providers = await app.request(
      `https://realm-policy-admin.example.com/realms/${alpha.id}/external-identity-providers`,
      {
        headers: adminHeaders,
      },
    )
    expect(providers.status).toBe(200)
    expect(await providers.text()).not.toContain("client-secret")
  })
})

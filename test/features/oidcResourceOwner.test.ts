import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { impersonationStart } from "../../src/features/impersonation/actions/impersonationStart.js"
import { oidcAuthorizationRequestAuthorize } from "../../src/features/oidc/actions/oidcAuthorizationRequestAuthorize.js"
import { oidcClientCreate } from "../../src/features/oidc/actions/oidcClientCreate.js"
import { oidcDiscoveryGet } from "../../src/features/oidc/actions/oidcDiscoveryGet.js"
import { oidcSigningKeyCreate } from "../../src/features/oidc/actions/oidcSigningKeyCreate.js"
import { oidcJwtVerify } from "../../src/features/oidc/domain/oidcJwtVerify.js"
import { oidcResourceOwnerScope } from "../../src/features/oidc/domain/oidcResourceOwnerScope.js"
import { oidcTokenResponseSchema } from "../../src/features/oidc/public/oidcTokenResponseSchema.js"
import { oidcResourceOwnerClaim } from "../../src/features/oidc/public/oidcResourceOwnerClaim.js"
import { oidcUserInfoSchema } from "../../src/features/oidc/public/oidcUserInfoSchema.js"
import { oidcServerAppCreate } from "../../src/features/oidc/server/oidcServerAppCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { realmBootstrapAdminAuthenticate } from "../../src/features/realms/actions/realmBootstrapAdminAuthenticate.js"
import { realmBootstrapAdminCreate } from "../../src/features/realms/actions/realmBootstrapAdminCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionPasswordCreate } from "../../src/features/sessions/actions/sessionPasswordCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

const resourceOwnerSecret = "oidc-resource-owner-secret"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-resource-owner-"))
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
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

async function createAuthenticatedSession(database: StorageDatabase, domain: string) {
  const realm = await createRealm(database, domain)
  const context = realmTenantContextCreate(realm.id, "anonymous")
  let verificationToken = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: `${domain.replaceAll(".", "-")}@example.com`,
      password: "Correct Horse 12",
      profile: { displayName: "OIDC User" },
      userName: domain.replaceAll(".", "-"),
    },
    realmId: realm.id,
    onVerificationToken: (delivery) => {
      verificationToken = delivery.token
    },
  })
  expect(registered.success).toBe(true)
  expect(
    passwordEmailVerify({
      context,
      database,
      input: { token: verificationToken },
      realmId: realm.id,
    }).success,
  ).toBe(true)
  const login = passwordLogin({
    context,
    database,
    input: { identifier: domain.replaceAll(".", "-"), password: "Correct Horse 12" },
    realmId: realm.id,
    sessionCreate: sessionPasswordCreate(),
  })
  expect(login.success).toBe(true)
  if (!login.success || login.data.session === undefined) throw new Error("The OIDC test session could not be created.")
  return { realm, token: login.data.session.token, userId: login.data.authentication.userId }
}

function pkceChallengeCreate(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url")
}

type Authenticated = Awaited<ReturnType<typeof createAuthenticatedSession>>

async function oidcTokenRequest(
  app: ReturnType<typeof oidcServerAppCreate>,
  domain: string,
  input: Record<string, string>,
): Promise<Response> {
  return app.fetch(
    new Request(`https://${domain}/oauth2/token`, {
      body: new URLSearchParams(input),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    }),
  )
}

async function createOidcTokenFixture(
  database: StorageDatabase,
  authenticated: Authenticated,
  scope = `openid ${oidcResourceOwnerScope}`,
) {
  const client = oidcClientCreate({
    context: realmSystemContextCreate(),
    database,
    input: {
      allowedScopes: ["openid", oidcResourceOwnerScope],
      clientType: "confidential",
      name: `${authenticated.realm.domain} resource-owner client`,
      redirectUris: ["https://client.example/callback"],
      trusted: true,
    },
    realmId: authenticated.realm.id,
  })
  expect(client.success).toBe(true)
  if (!client.success || client.data.clientSecret === undefined) throw new Error("The OIDC client fixture failed.")
  const key = oidcSigningKeyCreate({
    context: realmSystemContextCreate(),
    database,
    encryptionSecret: resourceOwnerSecret,
    realmId: authenticated.realm.id,
  })
  expect(key.success).toBe(true)
  if (!key.success) throw new Error(key.errorMessage)
  const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
  const authorization = oidcAuthorizationRequestAuthorize({
    database,
    input: {
      client_id: client.data.client.id,
      code_challenge: pkceChallengeCreate(verifier),
      code_challenge_method: "S256",
      redirect_uri: "https://client.example/callback",
      response_type: "code",
      scope,
      state: "resource-owner-state",
    },
    realmId: authenticated.realm.id,
    sessionToken: authenticated.token,
  })
  expect(authorization.success).toBe(true)
  if (!authorization.success) throw new Error(authorization.errorMessage)
  const app = oidcServerAppCreate({ database, systemSecret: resourceOwnerSecret })
  const response = await oidcTokenRequest(app, authenticated.realm.domain, {
    client_id: client.data.client.id,
    client_secret: client.data.clientSecret,
    code: authorization.data.code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: authorization.data.redirect_uri,
  })
  expect(response.status).toBe(200)
  return {
    app,
    key: key.data.signingKey,
    token: v.parse(oidcTokenResponseSchema, await response.json()),
  }
}

test("OIDC discovery advertises the Codeline resource-owner scope and claim", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "resource-owner-discovery.example.com")
    const discovery = oidcDiscoveryGet({ database, realmId: realm.id })
    expect(discovery.success).toBe(true)
    if (!discovery.success) return
    expect(discovery.data.scopes_supported).toContain(oidcResourceOwnerScope)
    expect(discovery.data.claims_supported).toContain(oidcResourceOwnerClaim)

    const app = oidcServerAppCreate({ database })
    const response = await app.fetch(new Request(`https://${realm.domain}/.well-known/openid-configuration`))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.scopes_supported).toContain(oidcResourceOwnerScope)
    expect(body.claims_supported).toContain(oidcResourceOwnerClaim)
  })
})

test("OIDC authorization accepts the resource-owner scope only when the client allows it", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "resource-owner-scope.example.com")
    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const createClient = (allowedScopes: string[]) =>
      oidcClientCreate({
        context: realmSystemContextCreate(),
        database,
        input: {
          allowedScopes,
          clientType: "public",
          name: `Scope client ${allowedScopes.join("-")}`,
          redirectUris: ["https://client.example/callback"],
          trusted: true,
        },
        realmId: authenticated.realm.id,
      })
    const allowed = createClient(["openid", oidcResourceOwnerScope])
    const denied = createClient(["openid"])
    expect(allowed.success).toBe(true)
    expect(denied.success).toBe(true)
    if (!allowed.success || !denied.success) return

    const authorization = (clientId: string) =>
      oidcAuthorizationRequestAuthorize({
        database,
        input: {
          client_id: clientId,
          code_challenge: pkceChallengeCreate(verifier),
          code_challenge_method: "S256",
          redirect_uri: "https://client.example/callback",
          response_type: "code",
          scope: `openid ${oidcResourceOwnerScope}`,
          state: "resource-owner-state",
        },
        realmId: authenticated.realm.id,
        sessionToken: authenticated.token,
      })
    expect(authorization(allowed.data.client.id).success).toBe(true)
    expect(authorization(denied.data.client.id).success).toBe(false)
  })
})

test("OIDC resource-owner claims require valid membership and use an explicit active context", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "resource-owner-claims.example.com")
    const firstOrganization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "First organization", ownerUserId: authenticated.userId },
      realmId: authenticated.realm.id,
    })
    expect(firstOrganization.success).toBe(true)
    if (!firstOrganization.success) return

    const standardMembership = await createOidcTokenFixture(database, authenticated, "openid")
    const standardIdToken = oidcJwtVerify(standardMembership.token.id_token, standardMembership.key.publicJwk)
    expect(standardIdToken).toMatchObject({ success: true })
    if (!standardIdToken.success) return
    expect(standardIdToken.data).not.toHaveProperty(oidcResourceOwnerClaim)
    const standardUserInfo = await standardMembership.app.fetch(
      new Request(`https://${authenticated.realm.domain}/oauth2/userinfo`, {
        headers: { authorization: `Bearer ${standardMembership.token.access_token}` },
      }),
    )
    expect(await standardUserInfo.json()).toEqual({ sub: authenticated.userId })

    const oneMembership = await createOidcTokenFixture(database, authenticated)
    const oneIdToken = oidcJwtVerify(oneMembership.token.id_token, oneMembership.key.publicJwk)
    expect(oneIdToken).toMatchObject({
      success: true,
      data: { [oidcResourceOwnerClaim]: firstOrganization.data.organization.id },
    })
    const oneUserInfo = await oneMembership.app.fetch(
      new Request(`https://${authenticated.realm.domain}/oauth2/userinfo`, {
        headers: { authorization: `Bearer ${oneMembership.token.access_token}` },
      }),
    )
    expect(v.parse(oidcUserInfoSchema, await oneUserInfo.json())).toEqual({
      [oidcResourceOwnerClaim]: firstOrganization.data.organization.id,
      sub: authenticated.userId,
    })

    const secondOrganization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Second organization", ownerUserId: authenticated.userId },
      realmId: authenticated.realm.id,
    })
    expect(secondOrganization.success).toBe(true)
    if (!secondOrganization.success) return

    const ambiguous = await createOidcTokenFixture(database, authenticated)
    const ambiguousIdToken = oidcJwtVerify(ambiguous.token.id_token, ambiguous.key.publicJwk)
    expect(ambiguousIdToken.success).toBe(true)
    if (!ambiguousIdToken.success) return
    expect(ambiguousIdToken.data).not.toHaveProperty(oidcResourceOwnerClaim)
    const ambiguousUserInfo = await ambiguous.app.fetch(
      new Request(`https://${authenticated.realm.domain}/oauth2/userinfo`, {
        headers: { authorization: `Bearer ${ambiguous.token.access_token}` },
      }),
    )
    expect(await ambiguousUserInfo.json()).toEqual({ sub: authenticated.userId })

    const bootstrap = realmBootstrapAdminCreate({
      context: realmSystemContextCreate("system"),
      database,
      realmId: authenticated.realm.id,
    })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return
    const bootstrapContext = realmBootstrapAdminAuthenticate({
      context: realmTenantContextCreate(authenticated.realm.id, "bootstrap-admin"),
      database,
      secret: bootstrap.data.bootstrapAdmin.secret.valueGet(),
    })
    expect(bootstrapContext.success).toBe(true)
    if (!bootstrapContext.success) return
    const selected = impersonationStart({
      actor: bootstrapContext.data.actor,
      database,
      durationMs: 60_000,
      organizationId: firstOrganization.data.organization.id,
      realmId: authenticated.realm.id,
      reason: "OIDC resource-owner test",
      targetUserId: authenticated.userId,
    })
    expect(selected.success).toBe(true)
    if (!selected.success) return

    const selectedFixture = await createOidcTokenFixture(database, {
      ...authenticated,
      token: selected.data.token,
    })
    const selectedIdToken = oidcJwtVerify(selectedFixture.token.id_token, selectedFixture.key.publicJwk)
    expect(selectedIdToken).toMatchObject({
      success: true,
      data: { [oidcResourceOwnerClaim]: firstOrganization.data.organization.id },
    })
    const selectedUserInfo = await selectedFixture.app.fetch(
      new Request(`https://${authenticated.realm.domain}/oauth2/userinfo`, {
        headers: { authorization: `Bearer ${selectedFixture.token.access_token}` },
      }),
    )
    expect(v.parse(oidcUserInfoSchema, await selectedUserInfo.json())).toEqual({
      [oidcResourceOwnerClaim]: firstOrganization.data.organization.id,
      act: { sub: bootstrapContext.data.actor.actorId },
      sub: authenticated.userId,
    })
  })
})

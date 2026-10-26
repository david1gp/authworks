import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { oidcAuthorizationRequestAuthorize } from "../../src/features/oidc/actions/oidcAuthorizationRequestAuthorize.js"
import { oidcClientCreate } from "../../src/features/oidc/actions/oidcClientCreate.js"
import { oidcSigningKeyCreate } from "../../src/features/oidc/actions/oidcSigningKeyCreate.js"
import { oidcApiClientCreate } from "../../src/features/oidc/client/oidcApiClientCreate.js"
import { oidcHashCreate } from "../../src/features/oidc/domain/oidcHashCreate.js"
import { oidcServerAppCreate } from "../../src/features/oidc/server/oidcServerAppCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationDomainClaim } from "../../src/features/organizations/actions/organizationDomainClaim.js"
import { organizationDomainVerify } from "../../src/features/organizations/actions/organizationDomainVerify.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { projectCreate } from "../../src/features/projects/actions/projectCreate.js"
import { projectGrantCreate } from "../../src/features/projects/actions/projectGrantCreate.js"
import { projectRoleCreate } from "../../src/features/projects/actions/projectRoleCreate.js"
import { projectUserAssignmentCreate } from "../../src/features/projects/actions/projectUserAssignmentCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionPasswordCreate } from "../../src/features/sessions/actions/sessionPasswordCreate.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-me-access-"))
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

function pkceChallengeCreate(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url")
}

async function registerAndLogin(database: StorageDatabase, realmId: string, slug: string) {
  const context = realmTenantContextCreate(realmId, "anonymous")
  let verificationToken = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: `${slug}@example.com`,
      password: "Correct Horse 12",
      profile: { displayName: "Me Access User" },
      userName: slug,
    },
    realmId,
    onVerificationToken: (delivery) => {
      verificationToken = delivery.token
    },
  })
  expect(registered.success).toBe(true)
  expect(passwordEmailVerify({ context, database, input: { token: verificationToken }, realmId }).success).toBe(true)
  const login = passwordLogin({
    context,
    database,
    input: { identifier: slug, password: "Correct Horse 12" },
    realmId,
    sessionCreate: sessionPasswordCreate(),
  })
  expect(login.success).toBe(true)
  if (!login.success || login.data.session === undefined) throw new Error("The me-access login failed.")
  return {
    session: login.data.session.session,
    token: login.data.session.token,
    userId: login.data.authentication.userId,
  }
}

async function organizationCreateWithVerifiedDomain(
  database: StorageDatabase,
  realmId: string,
  name: string,
  domain: string,
  ownerUserId?: string,
) {
  const organization = organizationCreate({
    context: realmSystemContextCreate(),
    database,
    input: { name, ...(ownerUserId === undefined ? {} : { ownerUserId }) },
    realmId,
  })
  expect(organization.success).toBe(true)
  if (!organization.success) throw new Error(organization.errorMessage)
  const claimed = organizationDomainClaim({
    context: realmSystemContextCreate(),
    database,
    input: { domain },
    organizationId: organization.data.organization.id,
    realmId,
  })
  expect(claimed.success).toBe(true)
  if (!claimed.success) throw new Error(claimed.errorMessage)
  const verificationToken = claimed.data.domain.verification?.recordValue ?? ""
  const verified = await organizationDomainVerify({
    context: realmSystemContextCreate(),
    database,
    dnsPort: { txtRecordsGet: async () => resultCreate([verificationToken]) },
    domain,
    organizationId: organization.data.organization.id,
    realmId,
  })
  expect(verified.success).toBe(true)
  return organization.data.organization
}

async function issueAccessToken(
  app: ReturnType<typeof oidcServerAppCreate>,
  database: StorageDatabase,
  options: { clientId: string; clientSecret: string; domain: string; realmId: string; sessionToken: string },
): Promise<string> {
  const verifier = `verifier-${options.clientId}-abcdefghijklmnopqrstuvwxyz._~`
  const authorization = oidcAuthorizationRequestAuthorize({
    database,
    input: {
      client_id: options.clientId,
      code_challenge: pkceChallengeCreate(verifier),
      code_challenge_method: "S256",
      redirect_uri: "https://client.example/callback",
      response_type: "code",
      scope: "openid",
      state: `me-access-${options.clientId}-${Date.now()}-${Math.random()}`,
    },
    realmId: options.realmId,
    sessionToken: options.sessionToken,
  })
  expect(authorization.success).toBe(true)
  if (!authorization.success) throw new Error(authorization.errorMessage)
  const response = await app.fetch(
    new Request(`https://${options.domain}/oauth2/token`, {
      body: new URLSearchParams({
        client_id: options.clientId,
        client_secret: options.clientSecret,
        code: authorization.data.code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: authorization.data.redirect_uri,
      }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    }),
  )
  expect(response.status).toBe(200)
  const body = (await response.json()) as { access_token: string }
  return body.access_token
}

function accessGet(app: ReturnType<typeof oidcServerAppCreate>, domain: string, accessToken?: string) {
  return app.fetch(
    new Request(`https://${domain}/oauth2/me/access`, {
      headers: accessToken === undefined ? {} : { authorization: `Bearer ${accessToken}` },
    }),
  )
}

test("GET /oauth2/me/access returns direct, grant-based, and multi-org access and omits role-less projects", async () => {
  await withDatabase(async (database) => {
    const domain = "me-access.example.com"
    const realm = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
    expect(realm.success).toBe(true)
    if (!realm.success) throw new Error(realm.errorMessage)
    const authenticated = await registerAndLogin(database, realm.data.realm.id, "me-access-user")

    const owner = await organizationCreateWithVerifiedDomain(
      database,
      realm.data.realm.id,
      "Access owner",
      "owner.me-access.example.com",
      authenticated.userId,
    )
    const granted = await organizationCreateWithVerifiedDomain(
      database,
      realm.data.realm.id,
      "Access granted",
      "granted.me-access.example.com",
    )
    expect(
      organizationMembershipCreate({
        context: realmSystemContextCreate(),
        database,
        input: { roles: ["member"], userId: authenticated.userId },
        organizationId: granted.id,
        realmId: realm.data.realm.id,
      }).success,
    ).toBe(true)

    const directProject = projectCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Direct project", organizationId: owner.id },
      realmId: realm.data.realm.id,
    })
    expect(directProject.success).toBe(true)
    if (!directProject.success) return
    expect(
      projectRoleCreate({
        context: realmSystemContextCreate(),
        database,
        input: { displayName: "Reader", key: "reader" },
        projectId: directProject.data.project.id,
        realmId: realm.data.realm.id,
      }).success,
    ).toBe(true)
    expect(
      projectUserAssignmentCreate({
        context: realmSystemContextCreate(),
        database,
        input: { roleKeys: ["reader"], userId: authenticated.userId },
        projectId: directProject.data.project.id,
        realmId: realm.data.realm.id,
      }).success,
    ).toBe(true)

    const sharedProject = projectCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Shared project", organizationId: owner.id },
      realmId: realm.data.realm.id,
    })
    expect(sharedProject.success).toBe(true)
    if (!sharedProject.success) return
    expect(
      projectRoleCreate({
        context: realmSystemContextCreate(),
        database,
        input: { displayName: "Granted reader", key: "granted-reader" },
        projectId: sharedProject.data.project.id,
        realmId: realm.data.realm.id,
      }).success,
    ).toBe(true)
    expect(
      projectGrantCreate({
        context: realmSystemContextCreate(),
        database,
        input: { grantedOrganizationId: granted.id, roleKeys: ["granted-reader"] },
        projectId: sharedProject.data.project.id,
        realmId: realm.data.realm.id,
      }).success,
    ).toBe(true)

    const emptyProject = projectCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Empty project", organizationId: owner.id },
      realmId: realm.data.realm.id,
    })
    expect(emptyProject.success).toBe(true)
    if (!emptyProject.success) return
    expect(
      projectRoleCreate({
        context: realmSystemContextCreate(),
        database,
        input: { displayName: "Unused", key: "unused" },
        projectId: emptyProject.data.project.id,
        realmId: realm.data.realm.id,
      }).success,
    ).toBe(true)

    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowedScopes: ["openid"],
        clientType: "confidential",
        name: "Me access client",
        redirectUris: ["https://client.example/callback"],
        trusted: true,
      },
      realmId: realm.data.realm.id,
    })
    expect(client.success && client.data.clientSecret !== undefined).toBe(true)
    if (!client.success || client.data.clientSecret === undefined) return
    expect(
      oidcSigningKeyCreate({
        context: realmSystemContextCreate(),
        database,
        encryptionSecret: "me-access-secret",
        realmId: realm.data.realm.id,
      }).success,
    ).toBe(true)

    const app = oidcServerAppCreate({ database, systemSecret: "me-access-secret" })
    const accessToken = await issueAccessToken(app, database, {
      clientId: client.data.client.id,
      clientSecret: client.data.clientSecret,
      domain,
      realmId: realm.data.realm.id,
      sessionToken: authenticated.token,
    })

    const response = await accessGet(app, domain, accessToken)
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    const body = (await response.json()) as {
      organizations: { id: string; name: string; primaryDomain: string | null; roles: string[] }[]
      projectRoles: { organizationId: string; projectId: string; roleKeys: string[] }[]
      sub: string
    }
    expect(body.sub).toBe(authenticated.userId)
    expect(body.organizations).toHaveLength(2)
    expect([...body.organizations].sort((left, right) => left.id.localeCompare(right.id))).toEqual(body.organizations)
    expect(body.organizations.find((organization) => organization.id === owner.id)).toEqual({
      id: owner.id,
      name: "Access owner",
      primaryDomain: "owner.me-access.example.com",
      roles: ["owner"],
    })
    expect(body.organizations.find((organization) => organization.id === granted.id)).toEqual({
      id: granted.id,
      name: "Access granted",
      primaryDomain: "granted.me-access.example.com",
      roles: ["member"],
    })
    expect(body.projectRoles).toHaveLength(2)
    expect(
      [...body.projectRoles].sort(
        (left, right) =>
          left.projectId.localeCompare(right.projectId) || left.organizationId.localeCompare(right.organizationId),
      ),
    ).toEqual(body.projectRoles)
    expect(body.projectRoles).toContainEqual({
      organizationId: owner.id,
      projectId: directProject.data.project.id,
      roleKeys: ["reader"],
    })
    expect(body.projectRoles).toContainEqual({
      organizationId: granted.id,
      projectId: sharedProject.data.project.id,
      roleKeys: ["granted-reader"],
    })

    const typed = oidcApiClientCreate({
      baseUrl: `https://${domain}`,
      fetch: (input, init) => Promise.resolve(app.fetch(new Request(input, init))),
    })
    const typedResult = await typed.oidcMeAccessGet(accessToken)
    expect(typedResult.success).toBe(true)
    if (typedResult.success) expect(typedResult.data).toEqual(body)
  })
})

test("GET /oauth2/me/access rejects untrusted clients, bad tokens, and dead sessions or users", async () => {
  await withDatabase(async (database) => {
    const domain = "me-access-denied.example.com"
    const realm = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
    expect(realm.success).toBe(true)
    if (!realm.success) throw new Error(realm.errorMessage)
    const authenticated = await registerAndLogin(database, realm.data.realm.id, "me-access-denied-user")

    const trustedClient = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowedScopes: ["openid"],
        clientType: "confidential",
        name: "Trusted me access client",
        redirectUris: ["https://client.example/callback"],
        requireConsent: false,
        trusted: true,
      },
      realmId: realm.data.realm.id,
    })
    const untrustedClient = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowedScopes: ["openid"],
        clientType: "confidential",
        name: "Untrusted me access client",
        redirectUris: ["https://client.example/callback"],
        requireConsent: false,
      },
      realmId: realm.data.realm.id,
    })
    expect(
      trustedClient.success &&
        trustedClient.data.clientSecret !== undefined &&
        untrustedClient.success &&
        untrustedClient.data.clientSecret !== undefined,
    ).toBe(true)
    if (
      !trustedClient.success ||
      trustedClient.data.clientSecret === undefined ||
      !untrustedClient.success ||
      untrustedClient.data.clientSecret === undefined
    )
      return
    expect(
      oidcSigningKeyCreate({
        context: realmSystemContextCreate(),
        database,
        encryptionSecret: "me-access-denied-secret",
        realmId: realm.data.realm.id,
      }).success,
    ).toBe(true)

    const app = oidcServerAppCreate({ database, systemSecret: "me-access-denied-secret" })
    const issue = (clientId: string, clientSecret: string) =>
      issueAccessToken(app, database, {
        clientId,
        clientSecret,
        domain,
        realmId: realm.data.realm.id,
        sessionToken: authenticated.token,
      })

    const untrustedToken = await issue(untrustedClient.data.client.id, untrustedClient.data.clientSecret)
    const untrustedResponse = await accessGet(app, domain, untrustedToken)
    expect(untrustedResponse.status).toBe(403)
    expect(await untrustedResponse.json()).toEqual({
      error: "insufficient_scope",
      error_description: "The client is not authorized for this resource.",
    })

    const expiredToken = await issue(trustedClient.data.client.id, trustedClient.data.clientSecret)
    database.sqlite
      .query("UPDATE oidc_access_tokens SET expires_at = ? WHERE token_hash = ?")
      .run(database.runtime.now() - 60_000, oidcHashCreate(expiredToken))
    const expiredResponse = await accessGet(app, domain, expiredToken)
    expect(expiredResponse.status).toBe(401)
    expect(await expiredResponse.json()).toEqual({
      error: "invalid_token",
      error_description: "The access token is invalid.",
    })
    expect(expiredResponse.headers.get("www-authenticate")).toContain('error="invalid_token"')

    const revokedToken = await issue(trustedClient.data.client.id, trustedClient.data.clientSecret)
    database.sqlite
      .query("UPDATE oidc_access_tokens SET revoked_at = ? WHERE token_hash = ?")
      .run(database.runtime.now(), oidcHashCreate(revokedToken))
    const revokedResponse = await accessGet(app, domain, revokedToken)
    expect(revokedResponse.status).toBe(401)
    expect((await revokedResponse.json()) as { error: string; error_description: string }).toEqual({
      error: "invalid_token",
      error_description: "The access token is invalid.",
    })

    const invalidResponse = await accessGet(app, domain, "not-a-token")
    expect(invalidResponse.status).toBe(401)
    expect(invalidResponse.headers.get("www-authenticate")).toContain('error="invalid_token"')

    const missingResponse = await accessGet(app, domain)
    expect(missingResponse.status).toBe(401)

    const sessionToken = await issue(trustedClient.data.client.id, trustedClient.data.clientSecret)
    database.sqlite
      .query("UPDATE sessions SET revoked_at = ? WHERE id = ?")
      .run(database.runtime.now(), authenticated.session.id)
    const revokedSessionResponse = await accessGet(app, domain, sessionToken)
    expect(revokedSessionResponse.status).toBe(401)
    expect((await revokedSessionResponse.json()) as { error: string; error_description: string }).toEqual({
      error: "invalid_token",
      error_description: "The access token is invalid.",
    })

    const relogin = await registerAndLogin(database, realm.data.realm.id, "me-access-denied-second")
    const deletedUserToken = await issueAccessToken(app, database, {
      clientId: trustedClient.data.client.id,
      clientSecret: trustedClient.data.clientSecret,
      domain,
      realmId: realm.data.realm.id,
      sessionToken: relogin.token,
    })
    database.sqlite.query("UPDATE users SET deleted_at = ? WHERE id = ?").run(database.runtime.now(), relogin.userId)
    const deletedUserResponse = await accessGet(app, domain, deletedUserToken)
    expect(deletedUserResponse.status).toBe(401)
    expect((await deletedUserResponse.json()) as { error: string; error_description: string }).toEqual({
      error: "invalid_token",
      error_description: "The access token is invalid.",
    })
  })
})

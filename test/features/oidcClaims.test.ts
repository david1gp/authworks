import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { oidcAuthorizationRequestAuthorize } from "../../src/features/oidc/actions/oidcAuthorizationRequestAuthorize.js"
import { oidcClientCreate } from "../../src/features/oidc/actions/oidcClientCreate.js"
import { oidcClientGet } from "../../src/features/oidc/actions/oidcClientGet.js"
import { oidcClientUpdate } from "../../src/features/oidc/actions/oidcClientUpdate.js"
import { oidcSigningKeyCreate } from "../../src/features/oidc/actions/oidcSigningKeyCreate.js"
import { oidcTokenIssue } from "../../src/features/oidc/actions/oidcTokenIssue.js"
import { oidcUserInfoGet } from "../../src/features/oidc/actions/oidcUserInfoGet.js"
import { oidcJwtVerify } from "../../src/features/oidc/domain/oidcJwtVerify.js"
import { oidcAuthorizationRequestSchema } from "../../src/features/oidc/public/oidcAuthorizationRequestSchema.js"
import { oidcJwksSchema } from "../../src/features/oidc/public/oidcJwksSchema.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationDomainClaim } from "../../src/features/organizations/actions/organizationDomainClaim.js"
import { organizationDomainVerify } from "../../src/features/organizations/actions/organizationDomainVerify.js"
import { organizationSwitch } from "../../src/features/organizations/actions/organizationSwitch.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { projectCreate } from "../../src/features/projects/actions/projectCreate.js"
import { projectRoleCreate } from "../../src/features/projects/actions/projectRoleCreate.js"
import { projectUserAssignmentCreate } from "../../src/features/projects/actions/projectUserAssignmentCreate.js"
import { oidcRepositoryCreate } from "../../src/features/oidc/persistence/oidcRepositoryCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionPasswordCreate } from "../../src/features/sessions/actions/sessionPasswordCreate.js"
import { zitadelMigrationImport } from "../../src/features/zitadelMigration/actions/zitadelMigrationImport.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"

const projectRoleClaim = "urn:zitadel:iam:org:project:roles"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-claims-"))
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"))
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function createAuthenticatedSession(database: StorageDatabase, domain: string) {
  const realm = realmCreate({
    context: realmSystemContextCreate(),
    database,
    input: { domain, name: domain },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const context = realmTenantContextCreate(realm.data.realm.id, "anonymous")
  let verificationToken = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: `${domain.replaceAll(".", "-")}@example.com`,
      password: "Correct Horse 12",
      profile: { displayName: "OIDC Claims User" },
      userName: domain.replaceAll(".", "-"),
    },
    realmId: realm.data.realm.id,
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
      realmId: realm.data.realm.id,
    }).success,
  ).toBe(true)
  const login = passwordLogin({
    context,
    database,
    input: { identifier: domain.replaceAll(".", "-"), password: "Correct Horse 12" },
    realmId: realm.data.realm.id,
    sessionCreate: sessionPasswordCreate(),
  })
  expect(login.success).toBe(true)
  if (!login.success || login.data.session === undefined) throw new Error("The OIDC claims session failed.")
  return {
    realm: realm.data.realm,
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

function pkceChallengeCreate(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url")
}

function organizationSessionSwitch(
  database: StorageDatabase,
  realmId: string,
  userId: string,
  sessionId: string,
  organizationId: string,
) {
  const switched = organizationSwitch({
    context: realmTenantContextCreate(realmId, userId),
    database,
    input: { organizationId },
    realmId,
    sessionId,
  })
  expect(switched.success).toBe(true)
  if (!switched.success) throw new Error(JSON.stringify(switched))
}

async function signingKeyCreate(database: StorageDatabase, realmId: string) {
  const signingKey = oidcSigningKeyCreate({
    context: realmSystemContextCreate(),
    database,
    encryptionSecret: "claims-secret",
    realmId,
  })
  expect(signingKey.success).toBe(true)
  if (!signingKey.success) throw new Error(signingKey.errorMessage)
  const key = v.parse(oidcJwksSchema, { keys: [signingKey.data.signingKey.publicJwk] }).keys[0]
  if (key === undefined) throw new Error("The OIDC claims signing key failed.")
  return key
}

async function projectWithRoleCreate(
  database: StorageDatabase,
  realmId: string,
  organizationId: string,
  userId: string,
  roleKey: string,
) {
  const project = projectCreate({
    context: realmSystemContextCreate(),
    database,
    input: { name: `Claims project ${roleKey}`, organizationId },
    realmId,
  })
  expect(project.success).toBe(true)
  if (!project.success) throw new Error(project.errorMessage)
  const role = projectRoleCreate({
    context: realmSystemContextCreate(),
    database,
    input: { displayName: roleKey, key: roleKey },
    projectId: project.data.project.id,
    realmId,
  })
  expect(role.success).toBe(true)
  if (!role.success) throw new Error(role.errorMessage)
  const assignment = projectUserAssignmentCreate({
    context: realmSystemContextCreate(),
    database,
    input: { roleKeys: [roleKey], userId },
    projectId: project.data.project.id,
    realmId,
  })
  expect(assignment.success).toBe(true)
  return project.data.project
}

async function tokenIssueForClient(
  database: StorageDatabase,
  realmId: string,
  sessionToken: string,
  clientId: string,
  redirectUri: string,
  state: string,
) {
  const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
  const requestInput = {
    client_id: clientId,
    code_challenge: pkceChallengeCreate(verifier),
    code_challenge_method: "S256" as const,
    redirect_uri: redirectUri,
    response_type: "code" as const,
    scope: "openid offline_access",
    state,
  }
  const parsedRequest = v.safeParse(oidcAuthorizationRequestSchema, requestInput)
  if (!parsedRequest.success) throw new Error(JSON.stringify(parsedRequest.issues))
  const request = oidcAuthorizationRequestAuthorize({ database, input: requestInput, realmId, sessionToken })
  expect(request.success).toBe(true)
  if (!request.success) throw new Error(JSON.stringify(request))
  const issued = oidcTokenIssue({
    database,
    encryptionSecret: "claims-secret",
    input: {
      client_id: clientId,
      code: request.data.code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: request.data.redirect_uri,
    },
    realmId,
  })
  expect(issued.success).toBe(true)
  if (!issued.success) throw new Error(issued.errorMessage)
  return issued.data
}

test("id-token role assertions follow the id-token flag independently of the access-token flag", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "oidc-claims.example.com")
    const owner = await organizationCreateWithVerifiedDomain(
      database,
      authenticated.realm.id,
      "Claims owner",
      "owner.oidc-claims.example.com",
      authenticated.userId,
    )
    organizationSessionSwitch(
      database,
      authenticated.realm.id,
      authenticated.userId,
      authenticated.session.id,
      owner.id,
    )
    const project = await projectWithRoleCreate(
      database,
      authenticated.realm.id,
      owner.id,
      authenticated.userId,
      "reader",
    )
    const clientInput = {
      allowedScopes: ["openid", "offline_access"],
      clientType: "public" as const,
      projectId: project.id,
      redirectUris: ["https://claims.example/callback"] as string[],
      trusted: true,
    }
    const both = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: { ...clientInput, accessTokenRoleAssertion: true, idTokenRoleAssertion: true, name: "Both assertions" },
      realmId: authenticated.realm.id,
    })
    const accessOnly = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: { ...clientInput, accessTokenRoleAssertion: true, name: "Access assertion only" },
      realmId: authenticated.realm.id,
    })
    const accessStay = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: { ...clientInput, accessTokenRoleAssertion: true, name: "Access assertion stays" },
      realmId: authenticated.realm.id,
    })
    const idOnly = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: { ...clientInput, idTokenRoleAssertion: true, name: "ID assertion only" },
      realmId: authenticated.realm.id,
    })
    expect(both.success && accessOnly.success && accessStay.success && idOnly.success).toBe(true)
    if (!both.success || !accessOnly.success || !accessStay.success || !idOnly.success) return
    expect(both.data.client.idTokenRoleAssertion).toBe(true)
    expect(accessOnly.data.client.idTokenRoleAssertion).toBe(false)

    const updated = oidcClientUpdate({
      clientId: accessOnly.data.client.id,
      context: realmSystemContextCreate(),
      database,
      input: { idTokenRoleAssertion: true },
      realmId: authenticated.realm.id,
    })
    expect(updated.success).toBe(true)
    if (!updated.success) return
    expect(updated.data.client.idTokenRoleAssertion).toBe(true)
    const fetched = oidcClientGet({
      clientId: accessOnly.data.client.id,
      context: realmSystemContextCreate(),
      database,
      realmId: authenticated.realm.id,
    })
    expect(fetched.success).toBe(true)
    if (!fetched.success) return
    expect(fetched.data.client.idTokenRoleAssertion).toBe(true)

    const key = await signingKeyCreate(database, authenticated.realm.id)
    const expected = { reader: { [owner.id]: "owner.oidc-claims.example.com" } }
    const bothTokens = await tokenIssueForClient(
      database,
      authenticated.realm.id,
      authenticated.token,
      both.data.client.id,
      "https://claims.example/callback",
      "both",
    )
    const bothAccess = oidcJwtVerify(bothTokens.access_token, key)
    const bothId = oidcJwtVerify(bothTokens.id_token, key)
    expect(bothAccess.success && bothId.success).toBe(true)
    if (!bothAccess.success || !bothId.success) return
    expect(bothAccess.data[projectRoleClaim]).toEqual(expected)
    expect(bothId.data[projectRoleClaim]).toEqual(expected)

    const accessTokens = await tokenIssueForClient(
      database,
      authenticated.realm.id,
      authenticated.token,
      accessStay.data.client.id,
      "https://claims.example/callback",
      "access-only",
    )
    const accessOnlyAccess = oidcJwtVerify(accessTokens.access_token, key)
    const accessOnlyId = oidcJwtVerify(accessTokens.id_token, key)
    expect(accessOnlyAccess.success && accessOnlyId.success).toBe(true)
    if (!accessOnlyAccess.success || !accessOnlyId.success) return
    expect(accessOnlyAccess.data[projectRoleClaim]).toEqual(expected)
    expect(accessOnlyId.data).not.toHaveProperty(projectRoleClaim)

    const idTokens = await tokenIssueForClient(
      database,
      authenticated.realm.id,
      authenticated.token,
      idOnly.data.client.id,
      "https://claims.example/callback",
      "id-only",
    )
    const idOnlyAccess = oidcJwtVerify(idTokens.access_token, key)
    const idOnlyId = oidcJwtVerify(idTokens.id_token, key)
    expect(idOnlyAccess.success && idOnlyId.success).toBe(true)
    if (!idOnlyAccess.success || !idOnlyId.success) return
    expect(idOnlyAccess.data).not.toHaveProperty(projectRoleClaim)
    expect(idOnlyId.data[projectRoleClaim]).toEqual(expected)
  })
})

test("userinfo carries role claims exactly when the access-token assertion is enabled", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "oidc-userinfo-roles.example.com")
    const owner = await organizationCreateWithVerifiedDomain(
      database,
      authenticated.realm.id,
      "Userinfo owner",
      "owner.oidc-userinfo-roles.example.com",
      authenticated.userId,
    )
    organizationSessionSwitch(
      database,
      authenticated.realm.id,
      authenticated.userId,
      authenticated.session.id,
      owner.id,
    )
    const project = await projectWithRoleCreate(
      database,
      authenticated.realm.id,
      owner.id,
      authenticated.userId,
      "viewer",
    )
    const clientInput = {
      allowedScopes: ["openid", "offline_access"],
      clientType: "public" as const,
      projectId: project.id,
      redirectUris: ["https://userinfo-roles.example/callback"] as string[],
      trusted: true,
    }
    const asserted = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: { ...clientInput, accessTokenRoleAssertion: true, name: "Asserted userinfo" },
      realmId: authenticated.realm.id,
    })
    const silent = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: { ...clientInput, idTokenRoleAssertion: true, name: "ID-only userinfo" },
      realmId: authenticated.realm.id,
    })
    expect(asserted.success && silent.success).toBe(true)
    if (!asserted.success || !silent.success) return
    await signingKeyCreate(database, authenticated.realm.id)
    const expected = { viewer: { [owner.id]: "owner.oidc-userinfo-roles.example.com" } }

    const assertedTokens = await tokenIssueForClient(
      database,
      authenticated.realm.id,
      authenticated.token,
      asserted.data.client.id,
      "https://userinfo-roles.example/callback",
      "asserted",
    )
    const assertedInfo = oidcUserInfoGet({
      database,
      realmId: authenticated.realm.id,
      token: assertedTokens.access_token,
    })
    expect(assertedInfo.success).toBe(true)
    if (!assertedInfo.success) return
    expect((assertedInfo.data as unknown as Record<string, unknown>)[projectRoleClaim]).toEqual(expected)

    const silentTokens = await tokenIssueForClient(
      database,
      authenticated.realm.id,
      authenticated.token,
      silent.data.client.id,
      "https://userinfo-roles.example/callback",
      "silent",
    )
    const silentInfo = oidcUserInfoGet({
      database,
      realmId: authenticated.realm.id,
      token: silentTokens.access_token,
    })
    expect(silentInfo.success).toBe(true)
    if (!silentInfo.success) return
    expect(silentInfo.data).not.toHaveProperty(projectRoleClaim)
  })
})

test("acr, amr, and auth_time are always present in id tokens and userinfo", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "oidc-amr.example.com")
    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowedScopes: ["openid", "offline_access"],
        clientType: "public",
        name: "AMR client",
        redirectUris: ["https://amr.example/callback"],
        trusted: true,
      },
      realmId: authenticated.realm.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    const key = await signingKeyCreate(database, authenticated.realm.id)

    const passwordSession = { assurance: "authenticated" as const, amr: ["password"] }
    const mfa = sessionIssue({
      assurance: "multi_factor",
      authenticationMethod: "password",
      database,
      mfaMethod: "totp",
      realmId: authenticated.realm.id,
      userId: authenticated.userId,
    })
    expect(mfa.success).toBe(true)
    if (!mfa.success) return
    const passkey = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "passkey",
      database,
      realmId: authenticated.realm.id,
      userId: authenticated.userId,
    })
    expect(passkey.success).toBe(true)
    if (!passkey.success) return

    const cases = [
      { label: "password", token: authenticated.token, createdAt: authenticated.session.createdAt, ...passwordSession },
      {
        label: "mfa",
        token: mfa.data.token,
        createdAt: mfa.data.session.createdAt,
        assurance: "multi_factor" as const,
        amr: ["password", "totp"],
      },
      {
        label: "passkey",
        token: passkey.data.token,
        createdAt: passkey.data.session.createdAt,
        assurance: "authenticated" as const,
        amr: ["passkey"],
      },
    ] as const
    for (const subject of cases) {
      const tokens = await tokenIssueForClient(
        database,
        authenticated.realm.id,
        subject.token,
        client.data.client.id,
        "https://amr.example/callback",
        subject.label,
      )
      const verified = oidcJwtVerify(tokens.id_token, key)
      expect(verified.success).toBe(true)
      if (!verified.success) return
      expect(verified.data.acr).toBe(subject.assurance)
      expect(verified.data.amr).toEqual([...subject.amr])
      expect(verified.data.auth_time).toBe(Math.floor(subject.createdAt / 1_000))
      const info = oidcUserInfoGet({ database, realmId: authenticated.realm.id, token: tokens.access_token })
      expect(info.success).toBe(true)
      if (!info.success) return
      expect(info.data.acr).toBe(subject.assurance)
      expect(info.data.amr).toEqual([...subject.amr])
      expect(info.data.auth_time).toBe(Math.floor(subject.createdAt / 1_000))
    }
  })
})

test("domain-less organizations resolve role claims under their organization id", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "oidc-domainless.example.com")
    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Domain-less org", ownerUserId: authenticated.userId },
      realmId: authenticated.realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    organizationSessionSwitch(
      database,
      authenticated.realm.id,
      authenticated.userId,
      authenticated.session.id,
      organization.data.organization.id,
    )
    const project = await projectWithRoleCreate(
      database,
      authenticated.realm.id,
      organization.data.organization.id,
      authenticated.userId,
      "member",
    )
    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        accessTokenRoleAssertion: true,
        allowedScopes: ["openid", "offline_access"],
        clientType: "public",
        idTokenRoleAssertion: true,
        name: "Domain-less client",
        projectId: project.id,
        redirectUris: ["https://domainless.example/callback"],
        trusted: true,
      },
      realmId: authenticated.realm.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    const key = await signingKeyCreate(database, authenticated.realm.id)
    const tokens = await tokenIssueForClient(
      database,
      authenticated.realm.id,
      authenticated.token,
      client.data.client.id,
      "https://domainless.example/callback",
      "domainless",
    )
    const expected = { member: { [organization.data.organization.id]: organization.data.organization.id } }
    const access = oidcJwtVerify(tokens.access_token, key)
    const id = oidcJwtVerify(tokens.id_token, key)
    expect(access.success && id.success).toBe(true)
    if (!access.success || !id.success) return
    expect(access.data[projectRoleClaim]).toEqual(expected)
    expect(id.data[projectRoleClaim]).toEqual(expected)
    const info = oidcUserInfoGet({ database, realmId: authenticated.realm.id, token: tokens.access_token })
    expect(info.success).toBe(true)
    if (!info.success) return
    expect((info.data as unknown as Record<string, unknown>)[projectRoleClaim]).toEqual(expected)
  })
})

test("consent is skipped exactly when the client is trusted or consent is not required", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "oidc-consent-matrix.example.com")
    const matrix = [
      { label: "trusted-required", requireConsent: true, trusted: true, consent: false },
      { label: "trusted-optional", requireConsent: false, trusted: true, consent: false },
      { label: "untrusted-required", requireConsent: true, trusted: false, consent: true },
      { label: "untrusted-optional", requireConsent: false, trusted: false, consent: false },
    ] as const
    for (const entry of matrix) {
      const client = oidcClientCreate({
        context: realmSystemContextCreate(),
        database,
        input: {
          allowedScopes: ["openid"],
          clientType: "public",
          name: `Consent ${entry.label}`,
          redirectUris: ["https://consent-matrix.example/callback"],
          requireConsent: entry.requireConsent,
          trusted: entry.trusted,
        },
        realmId: authenticated.realm.id,
      })
      expect(client.success).toBe(true)
      if (!client.success) return
      const request = oidcAuthorizationRequestAuthorize({
        database,
        input: {
          client_id: client.data.client.id,
          code_challenge: pkceChallengeCreate("verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"),
          code_challenge_method: "S256",
          redirect_uri: "https://consent-matrix.example/callback",
          response_type: "code",
          scope: "openid",
          state: entry.label,
        },
        realmId: authenticated.realm.id,
        sessionToken: authenticated.token,
      })
      expect(request.success).toBe(!entry.consent)
      if (!request.success) expect(request.op).toBe("oidcAuthorizationConsentRequired")
    }
  })
})

test("migration export and import preserve the id-token role assertion", async () => {
  const raw = JSON.parse(
    await readFile(join(import.meta.dir, "../fixtures", "zitadel-migration-snapshot.json"), "utf8"),
  ) as Record<string, unknown>
  raw.oidcApplications = [
    {
      accessTokenRoleAssertion: false,
      clientType: "public",
      credentials: [],
      createdAt: 1700000000000,
      idTokenRoleAssertion: true,
      name: "Role assertion round trip",
      projectId: "project-1",
      redirectUris: ["https://app.example/callback"],
      sourceId: "oidc-app-1",
      status: "active",
      tokenEndpointAuthMethod: "none",
      updatedAt: 1700000001000,
    },
  ]
  ;(raw.completeness as Record<string, unknown>).oidcApplications = { complete: true, count: 1 }
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "migration-round-trip.example.com", name: "Migration round trip" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const imported = zitadelMigrationImport({ database, realmId: realm.data.realm.id, snapshot: raw })
    expect(imported.success).toBe(true)
    if (!imported.success) return
    const clients = oidcRepositoryCreate(database.db).clientList(realm.data.realm.id)
    expect(clients.success).toBe(true)
    if (!clients.success) return
    const client = clients.data.find((entry) => entry.name === "Role assertion round trip")
    expect(client?.idTokenRoleAssertion).toBe(1)
    expect(client?.accessTokenRoleAssertion).toBe(0)
  })
})

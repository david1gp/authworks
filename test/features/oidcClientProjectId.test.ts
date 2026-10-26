import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { oidcAuthorizationRequestAuthorize } from "../../src/features/oidc/actions/oidcAuthorizationRequestAuthorize.js"
import { oidcClientCreate } from "../../src/features/oidc/actions/oidcClientCreate.js"
import { oidcClientGet } from "../../src/features/oidc/actions/oidcClientGet.js"
import { oidcClientList } from "../../src/features/oidc/actions/oidcClientList.js"
import { oidcClientUpdate } from "../../src/features/oidc/actions/oidcClientUpdate.js"
import { oidcSigningKeyCreate } from "../../src/features/oidc/actions/oidcSigningKeyCreate.js"
import { oidcTokenIssue } from "../../src/features/oidc/actions/oidcTokenIssue.js"
import { oidcJwtVerify } from "../../src/features/oidc/domain/oidcJwtVerify.js"
import { oidcAuthorizationRequestSchema } from "../../src/features/oidc/public/oidcAuthorizationRequestSchema.js"
import { oidcClientCreateRequestSchema } from "../../src/features/oidc/public/oidcClientCreateRequestSchema.js"
import { oidcClientSchema } from "../../src/features/oidc/public/oidcClientSchema.js"
import { oidcClientUpdateRequestSchema } from "../../src/features/oidc/public/oidcClientUpdateRequestSchema.js"
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
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionPasswordCreate } from "../../src/features/sessions/actions/sessionPasswordCreate.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"

const numericProjectId = "381760977282007057"
const uuidProjectId = "018f0000-0000-7000-8000-000000000001"
const invalidProjectIds = [
  "",
  "0",
  "01",
  "00381760977282007057",
  "project-1",
  "3817609772820070570x",
  "123456789012345678901",
]

const validCreateInput = {
  clientType: "public" as const,
  name: "Project client",
  redirectUris: ["https://client.example/callback"],
}

test("OIDC client schemas accept numeric migrated and UUIDv7 project IDs and reject malformed IDs", () => {
  for (const projectId of [numericProjectId, uuidProjectId]) {
    expect(v.safeParse(oidcClientCreateRequestSchema, { ...validCreateInput, projectId }).success).toBe(true)
    expect(v.safeParse(oidcClientUpdateRequestSchema, { projectId }).success).toBe(true)
  }
  for (const projectId of invalidProjectIds) {
    expect(v.safeParse(oidcClientCreateRequestSchema, { ...validCreateInput, projectId }).success).toBe(false)
    expect(v.safeParse(oidcClientUpdateRequestSchema, { projectId }).success).toBe(false)
  }
  expect(v.safeParse(oidcClientUpdateRequestSchema, { projectId: null }).success).toBe(true)
  expect(
    v.safeParse(oidcClientSchema, {
      allowedScopes: ["openid"],
      accessTokenLifetimeSeconds: null,
      accessTokenRoleAssertion: true,
      clientType: "public",
      additionalOrigins: [],
      createdAt: 1,
      devMode: false,
      grantTypes: ["authorization_code", "refresh_token"],
      id: uuidProjectId,
      idTokenLifetimeSeconds: null,
      idTokenRoleAssertion: false,
      idTokenUserinfoAssertion: false,
      realmId: uuidProjectId,
      name: "Project client",
      postLogoutRedirectUris: [],
      projectId: numericProjectId,
      redirectUris: ["https://client.example/callback"],
      refreshTokenAbsoluteLifetimeSeconds: null,
      refreshTokenIdleLifetimeSeconds: null,
      requireConsent: false,
      responseTypes: ["code"],
      status: "active",
      trusted: true,
      updatedAt: 1,
    }).success,
  ).toBe(true)
})

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-client-project-id-"))
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

function projectNumericIdSeed(database: StorageDatabase, realmId: string, organizationId: string) {
  const project = projectCreate({
    context: realmSystemContextCreate(),
    database,
    input: { name: "Migrated numeric project", organizationId },
    realmId,
  })
  expect(project.success).toBe(true)
  if (!project.success) throw new Error(project.errorMessage)
  database.sqlite.run("UPDATE projects SET id = ? WHERE id = ?", [numericProjectId, project.data.project.id])
  return numericProjectId
}

test("OIDC clients update to a migrated numeric project ID and round-trip through get and list", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "oidc-numeric-project.example.com", name: "OIDC numeric project realm" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Numeric project org" },
      realmId: realm.data.realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const projectId = projectNumericIdSeed(database, realm.data.realm.id, organization.data.organization.id)

    const created = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: { ...validCreateInput, name: "Numeric project client" },
      realmId: realm.data.realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(created.data.client.projectId).toBeUndefined()

    const updated = oidcClientUpdate({
      clientId: created.data.client.id,
      context: realmSystemContextCreate(),
      database,
      input: { projectId },
      realmId: realm.data.realm.id,
    })
    expect(updated.success).toBe(true)
    if (!updated.success) return
    expect(updated.data.client.projectId).toBe(projectId)

    const direct = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: { ...validCreateInput, name: "Direct numeric project client", projectId },
      realmId: realm.data.realm.id,
    })
    expect(direct.success).toBe(true)
    if (!direct.success) return
    expect(direct.data.client.projectId).toBe(projectId)

    const read = oidcClientGet({
      clientId: created.data.client.id,
      context: realmSystemContextCreate(),
      database,
      realmId: realm.data.realm.id,
    })
    expect(read.success).toBe(true)
    if (!read.success) return
    expect(read.data.client.projectId).toBe(projectId)

    const listed = oidcClientList({
      context: realmSystemContextCreate(),
      database,
      realmId: realm.data.realm.id,
    })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    const projectIds = listed.data.items
      .filter((client) => client.projectId !== undefined)
      .map((client) => client.projectId)
    expect(projectIds).toContain(projectId)

    const cleared = oidcClientUpdate({
      clientId: created.data.client.id,
      context: realmSystemContextCreate(),
      database,
      input: { projectId: null },
      realmId: realm.data.realm.id,
    })
    expect(cleared.success).toBe(true)
    if (!cleared.success) return
    expect(cleared.data.client.projectId).toBeUndefined()

    const unknown = oidcClientUpdate({
      clientId: created.data.client.id,
      context: realmSystemContextCreate(),
      database,
      input: { projectId: "0" },
      realmId: realm.data.realm.id,
    })
    expect(unknown.success).toBe(false)
  })
})

function pkceChallengeCreate(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url")
}

test("access tokens emit the project role claim for a client linked to a numeric project ID", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "oidc-numeric-claim.example.com", name: "OIDC numeric claim realm" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const realmId = realm.data.realm.id
    const context = realmTenantContextCreate(realmId, "anonymous")
    let verificationToken = ""
    const registered = passwordRegister({
      context,
      database,
      input: {
        email: "numeric-claim@example.com",
        password: "Correct Horse 12",
        profile: { displayName: "Numeric Claim User" },
        userName: "numeric-claim",
      },
      onVerificationToken: (delivery) => {
        verificationToken = delivery.token
      },
      realmId,
    })
    expect(registered.success).toBe(true)
    if (!registered.success) return
    expect(passwordEmailVerify({ context, database, input: { token: verificationToken }, realmId }).success).toBe(true)
    const login = passwordLogin({
      context,
      database,
      input: { identifier: "numeric-claim", password: "Correct Horse 12" },
      realmId,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(login.success).toBe(true)
    if (!login.success || login.data.session === undefined) throw new Error("The numeric claim session failed.")
    const userId = login.data.authentication.userId

    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Numeric claim org", ownerUserId: userId },
      realmId,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const organizationId = organization.data.organization.id
    const claimed = organizationDomainClaim({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "numeric-claim.example.com" },
      organizationId,
      realmId,
    })
    expect(claimed.success).toBe(true)
    if (!claimed.success) return
    const verified = await organizationDomainVerify({
      context: realmSystemContextCreate(),
      database,
      dnsPort: { txtRecordsGet: async () => resultCreate([claimed.data.domain.verification?.recordValue ?? ""]) },
      domain: "numeric-claim.example.com",
      organizationId,
      realmId,
    })
    expect(verified.success).toBe(true)
    const switched = organizationSwitch({
      context: realmTenantContextCreate(realmId, userId),
      database,
      input: { organizationId },
      realmId,
      sessionId: login.data.session.session.id,
    })
    expect(switched.success).toBe(true)

    const projectId = projectNumericIdSeed(database, realmId, organizationId)
    const role = projectRoleCreate({
      context: realmSystemContextCreate(),
      database,
      input: { displayName: "Numeric Reader", key: "numeric-reader" },
      projectId,
      realmId,
    })
    expect(role.success).toBe(true)
    if (!role.success) return
    expect(
      projectUserAssignmentCreate({
        context: realmSystemContextCreate(),
        database,
        input: { roleKeys: ["numeric-reader"], userId },
        projectId,
        realmId,
      }).success,
    ).toBe(true)

    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        ...validCreateInput,
        accessTokenRoleAssertion: true,
        name: "Numeric claim client",
        projectId,
        trusted: true,
      },
      realmId,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    const signingKey = oidcSigningKeyCreate({
      context: realmSystemContextCreate(),
      database,
      encryptionSecret: "numeric-claim-secret",
      realmId,
    })
    expect(signingKey.success).toBe(true)
    if (!signingKey.success) return
    const key = v.parse(oidcJwksSchema, { keys: [signingKey.data.signingKey.publicJwk] }).keys[0]
    if (key === undefined) return

    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const requestInput = {
      client_id: client.data.client.id,
      code_challenge: pkceChallengeCreate(verifier),
      code_challenge_method: "S256" as const,
      redirect_uri: "https://client.example/callback",
      response_type: "code" as const,
      scope: "openid",
      state: "numeric-claim-state",
    }
    expect(v.safeParse(oidcAuthorizationRequestSchema, requestInput).success).toBe(true)
    const request = oidcAuthorizationRequestAuthorize({
      database,
      input: requestInput,
      realmId,
      sessionToken: login.data.session.token,
    })
    expect(request.success).toBe(true)
    if (!request.success) throw new Error(JSON.stringify(request))
    const issued = oidcTokenIssue({
      database,
      encryptionSecret: "numeric-claim-secret",
      input: {
        client_id: client.data.client.id,
        code: request.data.code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: request.data.redirect_uri,
      },
      realmId,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) throw new Error(issued.errorMessage)
    const claims = oidcJwtVerify(issued.data.access_token, key)
    expect(claims).toMatchObject({
      success: true,
      data: {
        "urn:zitadel:iam:org:project:roles": { "numeric-reader": { [organizationId]: "numeric-claim.example.com" } },
      },
    })
  })
})

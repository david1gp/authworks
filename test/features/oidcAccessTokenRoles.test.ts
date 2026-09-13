import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { oidcAuthorizationRequestAuthorize } from "../../src/features/oidc/actions/oidcAuthorizationRequestAuthorize.js"
import { oidcClientCreate } from "../../src/features/oidc/actions/oidcClientCreate.js"
import { oidcSigningKeyCreate } from "../../src/features/oidc/actions/oidcSigningKeyCreate.js"
import { oidcTokenIssue } from "../../src/features/oidc/actions/oidcTokenIssue.js"
import { oidcJwtVerify } from "../../src/features/oidc/domain/oidcJwtVerify.js"
import { oidcAuthorizationRequestSchema } from "../../src/features/oidc/public/oidcAuthorizationRequestSchema.js"
import { oidcJwksSchema } from "../../src/features/oidc/public/oidcJwksSchema.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationDomainClaim } from "../../src/features/organizations/actions/organizationDomainClaim.js"
import { organizationDomainVerify } from "../../src/features/organizations/actions/organizationDomainVerify.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { organizationSwitch } from "../../src/features/organizations/actions/organizationSwitch.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { projectCreate } from "../../src/features/projects/actions/projectCreate.js"
import { projectGrantCreate } from "../../src/features/projects/actions/projectGrantCreate.js"
import { projectGrantLifecycleSet } from "../../src/features/projects/actions/projectGrantLifecycleSet.js"
import { projectRoleCreate } from "../../src/features/projects/actions/projectRoleCreate.js"
import { projectRoleDelete } from "../../src/features/projects/actions/projectRoleDelete.js"
import { projectUserAssignmentCreate } from "../../src/features/projects/actions/projectUserAssignmentCreate.js"
import { projectUserAssignmentRemove } from "../../src/features/projects/actions/projectUserAssignmentRemove.js"
import { projectSubjectProjectRoleResolve } from "../../src/features/projects/server/projectSubjectProjectRoleResolve.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionPasswordCreate } from "../../src/features/sessions/actions/sessionPasswordCreate.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-access-token-roles-"))
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
      profile: { displayName: "OIDC Role User" },
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
  if (!login.success || login.data.session === undefined) throw new Error("The OIDC role session failed.")
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

test("access-token role assertions are exact, project-scoped, and recomputed on refresh", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "oidc-role-assertion.example.com")
    const owner = await organizationCreateWithVerifiedDomain(
      database,
      authenticated.realm.id,
      "Role owner",
      "owner.role-assertion.example.com",
      authenticated.userId,
    )
    const switched = organizationSwitch({
      context: realmTenantContextCreate(authenticated.realm.id, authenticated.userId),
      database,
      input: { organizationId: owner.id },
      realmId: authenticated.realm.id,
      sessionId: authenticated.session.id,
    })
    expect(switched.success).toBe(true)
    if (!switched.success) throw new Error(JSON.stringify(switched))

    const granted = await organizationCreateWithVerifiedDomain(
      database,
      authenticated.realm.id,
      "Role grant",
      "grant.role-assertion.example.com",
    )
    expect(
      organizationMembershipCreate({
        context: realmSystemContextCreate(),
        database,
        input: { roles: ["member"], userId: authenticated.userId },
        organizationId: granted.id,
        realmId: authenticated.realm.id,
      }).success,
    ).toBe(true)

    const project = projectCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Role assertion project", organizationId: owner.id },
      realmId: authenticated.realm.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return
    const reader = projectRoleCreate({
      context: realmSystemContextCreate(),
      database,
      input: { displayName: "Reader", key: "reader" },
      projectId: project.data.project.id,
      realmId: authenticated.realm.id,
    })
    expect(reader.success).toBe(true)
    if (!reader.success) return
    const assignment = projectUserAssignmentCreate({
      context: realmSystemContextCreate(),
      database,
      input: { roleKeys: ["reader"], userId: authenticated.userId },
      projectId: project.data.project.id,
      realmId: authenticated.realm.id,
    })
    expect(assignment.success).toBe(true)
    if (!assignment.success) return
    const isolatedProject = projectCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Other role assertion project", organizationId: owner.id },
      realmId: authenticated.realm.id,
    })
    expect(isolatedProject.success).toBe(true)
    if (!isolatedProject.success) return
    const isolatedRole = projectRoleCreate({
      context: realmSystemContextCreate(),
      database,
      input: { displayName: "Other project role", key: "other-project-role" },
      projectId: isolatedProject.data.project.id,
      realmId: authenticated.realm.id,
    })
    expect(isolatedRole.success).toBe(true)
    if (!isolatedRole.success) return
    expect(
      projectUserAssignmentCreate({
        context: realmSystemContextCreate(),
        database,
        input: { roleKeys: ["other-project-role"], userId: authenticated.userId },
        projectId: isolatedProject.data.project.id,
        realmId: authenticated.realm.id,
      }).success,
    ).toBe(true)
    expect(
      projectSubjectProjectRoleResolve({
        executor: database.db,
        projectId: project.data.project.id,
        realmId: "other-realm",
        userId: authenticated.userId,
      }).success,
    ).toBe(false)

    const enabledClient = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        accessTokenRoleAssertion: true,
        clientType: "public",
        name: "Enabled role client",
        projectId: project.data.project.id,
        redirectUris: ["https://client.example/callback"],
        trusted: true,
      },
      realmId: authenticated.realm.id,
    })
    const disabledClient = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        clientType: "public",
        name: "Disabled role client",
        projectId: project.data.project.id,
        redirectUris: ["https://disabled.example/callback"],
        trusted: true,
      },
      realmId: authenticated.realm.id,
    })
    const noProjectClient = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        accessTokenRoleAssertion: true,
        clientType: "public",
        name: "No project role client",
        redirectUris: ["https://no-project.example/callback"],
        trusted: true,
      },
      realmId: authenticated.realm.id,
    })
    expect(enabledClient.success && disabledClient.success && noProjectClient.success).toBe(true)
    if (!enabledClient.success || !disabledClient.success || !noProjectClient.success) return
    const sessionRow = database.sqlite
      .query("SELECT organization_id FROM sessions WHERE id = ?")
      .get(authenticated.session.id) as { organization_id: string | null } | null
    if (sessionRow?.organization_id !== owner.id) throw new Error(JSON.stringify(sessionRow))

    const signingKey = oidcSigningKeyCreate({
      context: realmSystemContextCreate(),
      database,
      encryptionSecret: "role-assertion-secret",
      realmId: authenticated.realm.id,
    })
    expect(signingKey.success).toBe(true)
    if (!signingKey.success) return
    const key = v.parse(oidcJwksSchema, { keys: [signingKey.data.signingKey.publicJwk] }).keys[0]
    if (key === undefined) return
    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    let stateIndex = 0
    const tokenIssue = async (clientId: string) => {
      const redirectUri =
        clientId === disabledClient.data.client.id
          ? "https://disabled.example/callback"
          : clientId === noProjectClient.data.client.id
            ? "https://no-project.example/callback"
            : "https://client.example/callback"
      const requestInput = {
        client_id: clientId,
        code_challenge: pkceChallengeCreate(verifier),
        code_challenge_method: "S256" as const,
        redirect_uri: redirectUri,
        response_type: "code" as const,
        scope: "openid",
        state: `${clientId}-${stateIndex++}`,
      }
      const parsedRequest = v.safeParse(oidcAuthorizationRequestSchema, requestInput)
      if (!parsedRequest.success) throw new Error(JSON.stringify(parsedRequest.issues))
      const request = oidcAuthorizationRequestAuthorize({
        database,
        input: requestInput,
        realmId: authenticated.realm.id,
        sessionToken: authenticated.token,
      })
      if (!request.success) throw new Error(JSON.stringify(request))
      const issued = oidcTokenIssue({
        database,
        encryptionSecret: "role-assertion-secret",
        input: {
          client_id: clientId,
          code: request.data.code,
          code_verifier: verifier,
          grant_type: "authorization_code",
          redirect_uri: request.data.redirect_uri,
        },
        realmId: authenticated.realm.id,
      })
      expect(issued.success).toBe(true)
      if (!issued.success) throw new Error(issued.errorMessage)
      return issued.data
    }

    const enabledToken = await tokenIssue(enabledClient.data.client.id)
    const enabledClaims = oidcJwtVerify(enabledToken.access_token, key)
    expect(enabledClaims).toMatchObject({
      success: true,
      data: {
        "urn:zitadel:iam:org:project:roles": { reader: { [owner.id]: "owner.role-assertion.example.com" } },
      },
    })
    if (enabledClaims.success)
      expect(enabledClaims.data["urn:zitadel:iam:org:project:roles"]).not.toHaveProperty("other-project-role")
    const disabledClaims = oidcJwtVerify((await tokenIssue(disabledClient.data.client.id)).access_token, key)
    expect(disabledClaims.success).toBe(true)
    if (disabledClaims.success) expect(disabledClaims.data).not.toHaveProperty("urn:zitadel:iam:org:project:roles")
    const noProjectClaims = oidcJwtVerify((await tokenIssue(noProjectClient.data.client.id)).access_token, key)
    expect(noProjectClaims.success).toBe(true)
    if (noProjectClaims.success) expect(noProjectClaims.data).not.toHaveProperty("urn:zitadel:iam:org:project:roles")

    expect(
      projectRoleDelete({
        context: realmSystemContextCreate(),
        database,
        projectId: project.data.project.id,
        roleId: reader.data.role.id,
        realmId: authenticated.realm.id,
      }).success,
    ).toBe(true)
    const refreshedAfterRoleRevocation = oidcTokenIssue({
      database,
      encryptionSecret: "role-assertion-secret",
      input: {
        client_id: enabledClient.data.client.id,
        grant_type: "refresh_token",
        refresh_token: enabledToken.refresh_token,
      },
      realmId: authenticated.realm.id,
    })
    expect(refreshedAfterRoleRevocation.success).toBe(true)
    if (!refreshedAfterRoleRevocation.success) return
    const roleRevoked = oidcJwtVerify(refreshedAfterRoleRevocation.data.access_token, key)
    expect(roleRevoked.success).toBe(true)
    if (roleRevoked.success) expect(roleRevoked.data).not.toHaveProperty("urn:zitadel:iam:org:project:roles")

    const secondRole = projectRoleCreate({
      context: realmSystemContextCreate(),
      database,
      input: { displayName: "Granted reader", key: "granted-reader" },
      projectId: project.data.project.id,
      realmId: authenticated.realm.id,
    })
    expect(secondRole.success).toBe(true)
    if (!secondRole.success) return
    const grant = projectGrantCreate({
      context: realmSystemContextCreate(),
      database,
      input: { grantedOrganizationId: granted.id, roleKeys: ["granted-reader"] },
      projectId: project.data.project.id,
      realmId: authenticated.realm.id,
    })
    expect(grant.success).toBe(true)
    if (!grant.success) return
    const grantedToken = await tokenIssue(enabledClient.data.client.id)
    const grantedClaims = oidcJwtVerify(grantedToken.access_token, key)
    expect(grantedClaims).toMatchObject({
      success: true,
      data: {
        "urn:zitadel:iam:org:project:roles": {
          "granted-reader": { [granted.id]: "grant.role-assertion.example.com" },
        },
      },
    })
    expect(
      projectGrantLifecycleSet({
        context: realmSystemContextCreate(),
        database,
        grantId: grant.data.grant.id,
        input: { status: "inactive" },
        projectId: project.data.project.id,
        realmId: authenticated.realm.id,
      }).success,
    ).toBe(true)
    const refreshedAfterGrantRevocation = oidcTokenIssue({
      database,
      encryptionSecret: "role-assertion-secret",
      input: {
        client_id: enabledClient.data.client.id,
        grant_type: "refresh_token",
        refresh_token: grantedToken.refresh_token,
      },
      realmId: authenticated.realm.id,
    })
    expect(refreshedAfterGrantRevocation.success).toBe(true)
    if (!refreshedAfterGrantRevocation.success) return
    const grantRevoked = oidcJwtVerify(refreshedAfterGrantRevocation.data.access_token, key)
    expect(grantRevoked.success).toBe(true)
    if (grantRevoked.success) expect(grantRevoked.data).not.toHaveProperty("urn:zitadel:iam:org:project:roles")

    expect(
      projectUserAssignmentRemove({
        assignmentId: assignment.data.assignment.id,
        context: realmSystemContextCreate(),
        database,
        projectId: project.data.project.id,
        realmId: authenticated.realm.id,
      }).success,
    ).toBe(true)
  })
})

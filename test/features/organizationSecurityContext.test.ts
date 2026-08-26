import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { mfaChallengeComplete } from "../../src/features/mfa/actions/mfaChallengeComplete.js"
import { mfaStepUpStart } from "../../src/features/mfa/actions/mfaStepUpStart.js"
import { mfaTotpEnrollmentConfirm } from "../../src/features/mfa/actions/mfaTotpEnrollmentConfirm.js"
import { mfaTotpEnrollmentStart } from "../../src/features/mfa/actions/mfaTotpEnrollmentStart.js"
import { mfaTotpCodeCreate } from "../../src/features/mfa/domain/mfaTotpCodeCreate.js"
import { oidcAuthorizationInteractionCreate } from "../../src/features/oidc/actions/oidcAuthorizationInteractionCreate.js"
import { oidcAuthorizationInteractionResolve } from "../../src/features/oidc/actions/oidcAuthorizationInteractionResolve.js"
import { oidcClientCreate } from "../../src/features/oidc/actions/oidcClientCreate.js"
import { oidcInteractionOrganizationContextSet } from "../../src/features/oidc/server/oidcInteractionOrganizationContextSet.js"
import { oidcInteractionOrganizationContextValidate } from "../../src/features/oidc/server/oidcInteractionOrganizationContextValidate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationLifecycleSet } from "../../src/features/organizations/actions/organizationLifecycleSet.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { organizationMembershipRemove } from "../../src/features/organizations/actions/organizationMembershipRemove.js"
import { organizationMeSwitch } from "../../src/features/organizations/actions/organizationMeSwitch.js"
import { organizationRepositoryCreate } from "../../src/features/organizations/persistence/organizationRepositoryCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionRevoke } from "../../src/features/sessions/actions/sessionRevoke.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-organization-security-context-"))
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

function createActiveRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({
    context: realmSystemContextCreate(),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

function createActiveUser(database: StorageDatabase, realmId: string, suffix: string) {
  const created = userCreate({
    context: realmSystemContextCreate(),
    database,
    input: { email: `${suffix}@example.com`, profile: {}, userName: suffix },
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

test("OIDC organization context rejects fabricated, wrong-realm, and inactive context and revalidates completion", async () => {
  await withDatabase(async (database) => {
    const realm = createActiveRealm(database, "oidc-context-security.example.com")
    const otherRealm = createActiveRealm(database, "oidc-context-other.example.com")
    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "OIDC context organization" },
      realmId: realm.id,
    })
    const otherOrganization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Other realm organization" },
      realmId: otherRealm.id,
    })
    const inactiveOrganization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Inactive OIDC organization" },
      realmId: realm.id,
    })
    expect(organization.success && otherOrganization.success && inactiveOrganization.success).toBe(true)
    if (!organization.success || !otherOrganization.success || !inactiveOrganization.success) return
    const inactive = organizationLifecycleSet({
      context: realmSystemContextCreate(),
      database,
      input: { status: "inactive" },
      organizationId: inactiveOrganization.data.organization.id,
      realmId: realm.id,
    })
    expect(inactive.success).toBe(true)
    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        clientType: "public",
        name: "OIDC context client",
        redirectUris: ["https://client.example/callback"],
        requireConsent: true,
      },
      realmId: realm.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    const interaction = oidcAuthorizationInteractionCreate({
      database,
      encryptionSecret: "oidc-context-secret",
      input: {
        client_id: client.data.client.id,
        code_challenge: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
        code_challenge_method: "S256",
        redirect_uri: "https://client.example/callback",
        response_type: "code",
        scope: "openid",
        state: "oidc-context-state",
      },
      publicOrigin: "https://oidc-context-security.example.com",
      realmId: realm.id,
    })
    expect(interaction.success).toBe(true)
    if (!interaction.success) return
    expect(
      oidcInteractionOrganizationContextSet({
        database,
        handle: interaction.data.handle,
        organizationId: "018bcfe5-6800-7010-9010-101010101010",
        realmId: realm.id,
      }).success,
    ).toBe(false)
    expect(
      oidcInteractionOrganizationContextSet({
        database,
        handle: interaction.data.handle,
        organizationId: otherOrganization.data.organization.id,
        realmId: realm.id,
      }).success,
    ).toBe(false)
    expect(
      oidcInteractionOrganizationContextSet({
        database,
        handle: interaction.data.handle,
        organizationId: inactiveOrganization.data.organization.id,
        realmId: realm.id,
      }).success,
    ).toBe(false)
    expect(
      oidcInteractionOrganizationContextSet({
        database,
        handle: interaction.data.handle,
        organizationId: organization.data.organization.id,
        realmId: realm.id,
      }).success,
    ).toBe(true)
    expect(
      oidcInteractionOrganizationContextValidate({
        database,
        handle: interaction.data.handle,
        organizationId: organization.data.organization.id,
        realmId: realm.id,
      }).success,
    ).toBe(true)
    const resolved = oidcAuthorizationInteractionResolve({
      binding: interaction.data.binding,
      database,
      encryptionSecret: "oidc-context-secret",
      handle: interaction.data.handle,
      publicOrigin: "https://oidc-context-security.example.com",
      realmId: realm.id,
    })
    expect(resolved.success).toBe(true)
    const deactivated = organizationLifecycleSet({
      context: realmSystemContextCreate(),
      database,
      input: { status: "inactive" },
      organizationId: organization.data.organization.id,
      realmId: realm.id,
    })
    expect(deactivated.success).toBe(true)
    expect(
      oidcInteractionOrganizationContextValidate({
        database,
        handle: interaction.data.handle,
        organizationId: organization.data.organization.id,
        realmId: realm.id,
      }).success,
    ).toBe(false)
    expect(
      oidcAuthorizationInteractionResolve({
        binding: interaction.data.binding,
        database,
        encryptionSecret: "oidc-context-secret",
        handle: interaction.data.handle,
        publicOrigin: "https://oidc-context-security.example.com",
        realmId: realm.id,
      }).success,
    ).toBe(false)
  })
})

test("organization-bound sessions and /me switching require active membership and retain valid member context", async () => {
  await withDatabase(async (database) => {
    const realm = createActiveRealm(database, "organization-session-security.example.com")
    const member = createActiveUser(database, realm.id, "organization-member")
    const nonMember = createActiveUser(database, realm.id, "organization-non-member")
    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Member organization", ownerUserId: member.id },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    expect(
      sessionIssue({
        assurance: "authenticated",
        authenticationMethod: "password",
        database,
        organizationId: organization.data.organization.id,
        realmId: realm.id,
        userId: nonMember.id,
      }).success,
    ).toBe(false)
    const session = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.id,
      userId: member.id,
    })
    expect(session.success).toBe(true)
    if (!session.success) return
    expect(
      organizationMeSwitch({
        context: realmTenantContextCreate(realm.id, nonMember.id),
        database,
        input: { organizationId: organization.data.organization.id },
        realmId: realm.id,
      }).success,
    ).toBe(false)
    expect(
      organizationMeSwitch({
        context: realmTenantContextCreate(realm.id, member.id),
        database,
        input: { organizationId: organization.data.organization.id },
        realmId: realm.id,
        sessionId: "018bcfe5-6800-7010-9010-101010101010",
      }),
    ).toMatchObject({ code: "sessions.unauthorized", success: false })
    const forgedContext = {
      ...realmTenantContextCreate(realm.id, member.id),
      actor: {
        ...realmTenantContextCreate(realm.id, member.id).actor,
        assurance: "multi_factor" as const,
      },
    }
    expect(
      organizationMeSwitch({
        context: forgedContext,
        database,
        input: { organizationId: organization.data.organization.id },
        realmId: realm.id,
        sessionId: session.data.session.id,
      }),
    ).toMatchObject({ code: "sessions.unauthorized", success: false })
    const staleSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.id,
      userId: member.id,
    })
    expect(staleSession.success).toBe(true)
    if (!staleSession.success) return
    expect(
      sessionRevoke({
        database,
        realmId: realm.id,
        sessionId: staleSession.data.session.id,
        userId: member.id,
      }).success,
    ).toBe(true)
    expect(
      organizationMeSwitch({
        context: realmTenantContextCreate(realm.id, member.id),
        database,
        input: { organizationId: organization.data.organization.id },
        realmId: realm.id,
        sessionId: staleSession.data.session.id,
      }),
    ).toMatchObject({ code: "sessions.unauthorized", success: false })
    const switched = organizationMeSwitch({
      context: realmTenantContextCreate(realm.id, member.id),
      database,
      input: { organizationId: organization.data.organization.id },
      realmId: realm.id,
      sessionId: session.data.session.id,
    })
    expect(switched.success).toBe(true)
    expect(switched.success ? switched.data.activeOrganizationId : undefined).toBe(organization.data.organization.id)
    const authenticated = sessionAuthenticate({ database, realmId: realm.id, token: session.data.token })
    expect(authenticated.success).toBe(true)
    expect(authenticated.success ? authenticated.data.session.organizationId : undefined).toBe(
      organization.data.organization.id,
    )
  })
})

test("organization step-up rejects non-members and contexts deactivated after start", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = createActiveRealm(database, "organization-step-up-security.example.com")
    const owner = createActiveUser(database, realm.id, "organization-step-up-owner")
    const member = createActiveUser(database, realm.id, "organization-step-up-member")
    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Step-up organization", ownerUserId: owner.id },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const added = organizationMembershipCreate({
      context: realmSystemContextCreate(),
      database,
      input: { roles: ["member"], userId: member.id },
      organizationId: organization.data.organization.id,
      realmId: realm.id,
    })
    expect(added.success).toBe(true)
    if (!added.success) return
    const ownerEnrollment = mfaTotpEnrollmentStart({
      database,
      encryptionSecret: "organization-step-up-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
      userId: owner.id,
    })
    expect(ownerEnrollment.success).toBe(true)
    if (!ownerEnrollment.success) return
    const ownerCode = mfaTotpCodeCreate(ownerEnrollment.data.secret, Math.floor(testkit.runtime.now() / 30_000))
    expect(ownerCode.success).toBe(true)
    if (!ownerCode.success) return
    expect(
      mfaTotpEnrollmentConfirm({
        database,
        encryptionSecret: "organization-step-up-secret",
        input: { code: ownerCode.data, enrollmentId: ownerEnrollment.data.enrollment.id },
        realmId: realm.id,
        runtime: testkit.runtime,
        userId: owner.id,
      }).success,
    ).toBe(true)
    const memberEnrollment = mfaTotpEnrollmentStart({
      database,
      encryptionSecret: "organization-step-up-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
      userId: member.id,
    })
    expect(memberEnrollment.success).toBe(true)
    if (!memberEnrollment.success) return
    const memberCode = mfaTotpCodeCreate(memberEnrollment.data.secret, Math.floor(testkit.runtime.now() / 30_000))
    expect(memberCode.success).toBe(true)
    if (!memberCode.success) return
    expect(
      mfaTotpEnrollmentConfirm({
        database,
        encryptionSecret: "organization-step-up-secret",
        input: { code: memberCode.data, enrollmentId: memberEnrollment.data.enrollment.id },
        realmId: realm.id,
        runtime: testkit.runtime,
        userId: member.id,
      }).success,
    ).toBe(true)
    const ownerSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      organizationId: organization.data.organization.id,
      realmId: realm.id,
      userId: owner.id,
    })
    const memberSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      organizationId: organization.data.organization.id,
      realmId: realm.id,
      userId: member.id,
    })
    expect(ownerSession.success && memberSession.success).toBe(true)
    if (!ownerSession.success || !memberSession.success) return
    const memberMembership = organizationRepositoryCreate(database.db).organizationMembershipGetByOrganizationUser(
      organization.data.organization.id,
      member.id,
    )
    expect(memberMembership.success).toBe(true)
    if (!memberMembership.success || memberMembership.data === null) return
    expect(
      organizationMembershipRemove({
        context: realmSystemContextCreate(),
        database,
        membershipId: memberMembership.data.id,
        organizationId: organization.data.organization.id,
        realmId: realm.id,
      }).success,
    ).toBe(true)
    expect(
      mfaStepUpStart({
        database,
        realmId: realm.id,
        sessionId: memberSession.data.session.id,
        userId: member.id,
      }).success,
    ).toBe(false)
    const started = mfaStepUpStart({
      database,
      realmId: realm.id,
      sessionId: ownerSession.data.session.id,
      userId: owner.id,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    expect(
      organizationLifecycleSet({
        context: realmSystemContextCreate(),
        database,
        input: { status: "inactive" },
        organizationId: organization.data.organization.id,
        realmId: realm.id,
      }).success,
    ).toBe(true)
    const completionCode = mfaTotpCodeCreate(ownerEnrollment.data.secret, Math.floor(testkit.runtime.now() / 30_000))
    expect(completionCode.success).toBe(true)
    if (!completionCode.success) return
    expect(
      mfaChallengeComplete({
        database,
        encryptionSecret: "organization-step-up-secret",
        input: { code: completionCode.data, token: started.data.token },
        realmId: realm.id,
        sessionToken: ownerSession.data.token,
      }).success,
    ).toBe(false)
  })
})

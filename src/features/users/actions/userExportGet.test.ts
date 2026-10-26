import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { externalIdentityProviderCreate } from "../../externalIdentities/actions/externalIdentityProviderCreate.js"
import { externalIdentityRepositoryCreate } from "../../externalIdentities/persistence/externalIdentityRepositoryCreate.js"
import { mfaRecoveryCodesGenerate } from "../../mfa/actions/mfaRecoveryCodesGenerate.js"
import { mfaTotpEnrollmentConfirm } from "../../mfa/actions/mfaTotpEnrollmentConfirm.js"
import { mfaTotpEnrollmentStart } from "../../mfa/actions/mfaTotpEnrollmentStart.js"
import { mfaTotpCodeCreate } from "../../mfa/domain/mfaTotpCodeCreate.js"
import { organizationCreate } from "../../organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../organizations/actions/organizationMembershipCreate.js"
import { passkeyCredentialRename } from "../../passkeys/actions/passkeyCredentialRename.js"
import { passkeyRepositoryCreate } from "../../passkeys/persistence/passkeyRepositoryCreate.js"
import { passwordRepositoryCreate } from "../../passwords/persistence/passwordRepositoryCreate.js"
import { realmCreate, realmSystemContextCreate, realmTenantContextCreate } from "../../realms/server/index.js"
import { sessionIssue } from "../../sessions/actions/sessionIssue.js"
import { sessionRepositoryCreate } from "../../sessions/persistence/sessionRepositoryCreate.js"
import { userApiClientCreate } from "../client/userApiClientCreate.js"
import { userServerAppCreate } from "../server/userServerAppCreate.js"
import { userCreate } from "./userCreate.js"
import { userEmailAddressAddStart } from "./userEmailAddressAddStart.js"
import { userEmailAddressAddVerify } from "./userEmailAddressAddVerify.js"
import { userExportGet } from "./userExportGet.js"
import { userLifecycleSet } from "./userLifecycleSet.js"
import { userPhoneNumberChange } from "./userPhoneNumberChange.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-user-export-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(opened.errorMessage)
  }
  try {
    return await operation(opened.data, testkit)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

test("user export matches seeded profile, emails, memberships, and omits credential material", async () => {
  await withDatabase(async (database, testkit) => {
    const system = realmSystemContextCreate("system")
    const realm = realmCreate({ context: system, database, input: { domain: "export.example.com", name: "Export" } })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const created = userCreate({
      context: system,
      database,
      input: {
        email: "export-a@example.com",
        profile: { displayName: "Export Ada", firstName: "Export", lastName: "Ada" },
        userName: "export-a",
      },
      realmId: realm.data.realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const userId = created.data.user.id
    const subject = realmTenantContextCreate(realm.data.realm.id, userId)

    const activated = userLifecycleSet({
      context: system,
      database,
      input: { state: "active" },
      realmId: realm.data.realm.id,
      userId,
    })
    expect(activated.success).toBe(true)

    const phone = userPhoneNumberChange({
      context: system,
      database,
      input: { phoneNumber: "+14155550132" },
      realmId: realm.data.realm.id,
      userId,
    })
    expect(phone.success).toBe(true)

    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      deviceMetadata: { description: "Export Browser" },
      realmId: realm.data.realm.id,
      runtime: testkit.runtime,
      userId,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return
    const geoSeeded = sessionRepositoryCreate(database.db).sessionGeoUpdate(
      realm.data.realm.id,
      issued.data.session.id,
      {
        countryCode: "DE",
        region: "Berlin",
      },
    )
    expect(geoSeeded.success).toBe(true)

    let verificationToken = ""
    const emailStart = await userEmailAddressAddStart({
      context: subject,
      database,
      input: { email: "export-a-second@example.com" },
      onDelivery: (delivery) => {
        verificationToken = delivery.token
      },
      rateLimitSecret: "export-rate-limit-secret",
      realmId: realm.data.realm.id,
      session: issued.data.session,
      userId,
    })
    expect(emailStart.success).toBe(true)
    if (!emailStart.success) return
    const emailVerify = await userEmailAddressAddVerify({
      context: subject,
      database,
      input: { challengeId: emailStart.data.challengeId, token: verificationToken },
      rateLimitSecret: "export-rate-limit-secret",
      realmId: realm.data.realm.id,
      session: issued.data.session,
      userId,
    })
    expect(emailVerify.success).toBe(true)

    const organization = organizationCreate({
      context: system,
      database,
      input: { name: "Export Org" },
      realmId: realm.data.realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const membership = organizationMembershipCreate({
      context: system,
      database,
      input: { roles: ["admin"], userId },
      organizationId: organization.data.organization.id,
      realmId: realm.data.realm.id,
    })
    expect(membership.success).toBe(true)

    const totpStart = mfaTotpEnrollmentStart({
      database,
      encryptionSecret: "export-encryption-secret",
      realmId: realm.data.realm.id,
      runtime: testkit.runtime,
      userId,
    })
    expect(totpStart.success).toBe(true)
    if (!totpStart.success) return
    const totpCode = mfaTotpCodeCreate(totpStart.data.secret, Math.floor(testkit.runtime.now() / 30_000))
    expect(totpCode.success).toBe(true)
    if (!totpCode.success) return
    const totpConfirm = mfaTotpEnrollmentConfirm({
      database,
      encryptionSecret: "export-encryption-secret",
      input: { code: totpCode.data, enrollmentId: totpStart.data.enrollment.id },
      realmId: realm.data.realm.id,
      runtime: testkit.runtime,
      userId,
    })
    expect(totpConfirm.success).toBe(true)
    const recoveryCodes = mfaRecoveryCodesGenerate({
      database,
      realmId: realm.data.realm.id,
      runtime: testkit.runtime,
      userId,
    })
    expect(recoveryCodes.success).toBe(true)
    if (!recoveryCodes.success) return

    const password = passwordRepositoryCreate(database.db).passwordCredentialCreate({
      changedAt: testkit.runtime.now(),
      createdAt: testkit.runtime.now(),
      hash: "export-password-hash-material",
      passwordChangeRequired: 0,
      realmId: realm.data.realm.id,
      userId,
      version: 1,
    })
    expect(password.success).toBe(true)

    const passkeys = passkeyRepositoryCreate(database.db)
    const passkey = passkeys.passkeyCredentialCreate({
      aaguid: "export-aaguid",
      backedUp: 0,
      counter: 0,
      createdAt: testkit.runtime.now(),
      credentialId: "export-credential-material",
      deviceType: "singleDevice",
      id: "export-credential-id",
      lastUsedAt: null,
      publicKey: Buffer.from("export-public-key-material"),
      realmId: realm.data.realm.id,
      revokedAt: null,
      rpId: "export.example.com",
      transports: '["internal"]',
      userId,
      version: 1,
    })
    expect(passkey.success).toBe(true)
    const renamed = passkeyCredentialRename({
      credentialId: "export-credential-id",
      database,
      input: { nickname: "Export Key" },
      realmId: realm.data.realm.id,
      userId,
    })
    expect(renamed.success).toBe(true)

    const provider = externalIdentityProviderCreate({
      allowDevelopmentFallback: true,
      context: system,
      database,
      input: {
        allowAccountCreation: false,
        clientId: "export-client",
        clientSecret: "export-provider-secret",
        displayName: "Export Provider",
        redirectUri: "https://export.example.com/callback",
        type: "google",
      },
      realmId: realm.data.realm.id,
    })
    expect(provider.success).toBe(true)
    if (!provider.success) return
    const identity = externalIdentityRepositoryCreate(database.db).externalIdentityCreate({
      createdAt: testkit.runtime.now(),
      displayName: "Export External",
      email: "export-external@example.com",
      emailVerified: true,
      externalSubject: "export-external-subject",
      id: "export-external-identity",
      providerId: provider.data.provider.id,
      realmId: realm.data.realm.id,
      updatedAt: testkit.runtime.now(),
      userId,
      username: null,
      version: 1,
    })
    expect(identity.success).toBe(true)

    const app = userServerAppCreate({ database, publicOrigin: "https://export.example.com", systemSecret: "s" })
    const client = userApiClientCreate({
      baseUrl: "https://export.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: issued.data.token,
    })
    const exported = await client.userMeExportGet(realm.data.realm.id)
    expect(exported.success).toBe(true)
    if (!exported.success || exported.status !== "current") return
    expect(exported.data.userId).toBe(userId)
    expect(exported.data.userName).toBe("export-a")
    expect(exported.data.profile).toMatchObject({ displayName: "Export Ada", firstName: "Export", lastName: "Ada" })
    expect(exported.data.emails).toContainEqual({
      address: "export-a@example.com",
      primary: true,
      verified: false,
    })
    expect(exported.data.emails).toContainEqual({
      address: "export-a-second@example.com",
      primary: false,
      verified: true,
    })
    expect(exported.data.phone).toEqual({ number: "+14155550132", verified: true })
    expect(exported.data.memberships).toEqual([
      { organizationId: organization.data.organization.id, organizationName: "Export Org", roles: ["admin"] },
    ])
    expect(exported.data.externalIdentities).toEqual([
      { displayName: "Export External", providerId: provider.data.provider.id, providerType: "google" },
    ])
    expect(exported.data.passkeys).toHaveLength(1)
    expect(exported.data.passkeys[0]).toMatchObject({ nickname: "Export Key" })
    expect(exported.data.mfa).toMatchObject({
      emailOtp: false,
      passkeyCount: 1,
      password: true,
      recoveryCodesAvailable: true,
      totpEnrolled: true,
    })
    expect(exported.data.sessions).toHaveLength(1)
    expect(exported.data.sessions[0]).toMatchObject({
      assurance: "authenticated",
      countryCode: "DE",
      current: true,
      region: "Berlin",
    })
    expect(exported.data.consents).toEqual([])

    const serialized = JSON.stringify(exported.data)
    expect(serialized).not.toContain(totpStart.data.secret)
    expect(serialized).not.toContain(recoveryCodes.data.codes[0] ?? "export-recovery-code-missing")
    expect(serialized).not.toContain("export-password-hash-material")
    expect(serialized).not.toContain("export-credential-material")
    expect(serialized).not.toContain("export-public-key-material")
    expect(serialized).not.toContain("export-provider-secret")
    expect(serialized).not.toContain("export-external-subject")
    expect(serialized).not.toContain(issued.data.token)
    expect(serialized).not.toContain(verificationToken)
  })
})

test("user export is isolated to the session user and realm", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const alpha = realmCreate({ context: system, database, input: { domain: "export-a.example.com", name: "A" } })
    const beta = realmCreate({ context: system, database, input: { domain: "export-b.example.com", name: "B" } })
    expect(alpha.success && beta.success).toBe(true)
    if (!alpha.success || !beta.success) return

    const userA = userCreate({
      context: system,
      database,
      input: { email: "isolated-a@example.com", profile: { displayName: "Isolated A" }, userName: "isolated-a" },
      realmId: alpha.data.realm.id,
    })
    const userB = userCreate({
      context: system,
      database,
      input: { email: "isolated-b@example.com", profile: { displayName: "Isolated B" }, userName: "isolated-b" },
      realmId: alpha.data.realm.id,
    })
    const userC = userCreate({
      context: system,
      database,
      input: { email: "isolated-c@example.com", profile: { displayName: "Isolated C" }, userName: "isolated-c" },
      realmId: beta.data.realm.id,
    })
    expect(userA.success && userB.success && userC.success).toBe(true)
    if (!userA.success || !userB.success || !userC.success) return
    for (const user of [userA, userB, userC]) {
      const activated = userLifecycleSet({
        context: system,
        database,
        input: { state: "active" },
        realmId: user.data.user.realmId,
        userId: user.data.user.id,
      })
      expect(activated.success).toBe(true)
    }

    const issuedA = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: alpha.data.realm.id,
      userId: userA.data.user.id,
    })
    const issuedC = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: beta.data.realm.id,
      userId: userC.data.user.id,
    })
    expect(issuedA.success && issuedC.success).toBe(true)
    if (!issuedA.success || !issuedC.success) return

    const app = userServerAppCreate({ database, publicOrigin: "https://export.example.com" })
    const clientA = userApiClientCreate({
      baseUrl: "https://export.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: issuedA.data.token,
    })
    const exported = await clientA.userMeExportGet(alpha.data.realm.id)
    expect(exported.success).toBe(true)
    if (!exported.success || exported.status !== "current") return
    expect(exported.data.userId).toBe(userA.data.user.id)
    const serialized = JSON.stringify(exported.data)
    expect(serialized).not.toContain("isolated-b@example.com")
    expect(serialized).not.toContain("isolated-b")
    expect(serialized).not.toContain("Isolated B")
    expect(serialized).not.toContain("isolated-c@example.com")
    expect(serialized).not.toContain(userB.data.user.id)
    expect(serialized).not.toContain(userC.data.user.id)

    const crossRealm = await app.request(`https://export.example.com/realms/${beta.data.realm.id}/me/export`, {
      headers: { authorization: `Bearer ${issuedA.data.token}` },
    })
    expect(crossRealm.status).toBe(401)
    const unauthenticated = await app.request(`https://export.example.com/realms/${alpha.data.realm.id}/me/export`)
    expect(unauthenticated.status).toBe(401)

    const mismatched = userExportGet({
      context: realmTenantContextCreate(beta.data.realm.id, userC.data.user.id),
      database,
      realmId: alpha.data.realm.id,
      session: issuedC.data.session,
      userId: userA.data.user.id,
    })
    expect(mismatched).toMatchObject({ code: "users.tenant-mismatch", success: false })
    const otherUser = userExportGet({
      context: realmTenantContextCreate(alpha.data.realm.id, userB.data.user.id),
      database,
      realmId: alpha.data.realm.id,
      session: issuedA.data.session,
      userId: userA.data.user.id,
    })
    expect(otherUser).toMatchObject({ code: "users.forbidden", success: false })
  })
})

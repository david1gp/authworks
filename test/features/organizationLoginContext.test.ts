import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { emailOtpStart } from "../../src/features/emailOtp/actions/emailOtpStart.js"
import { emailOtpVerify } from "../../src/features/emailOtp/actions/emailOtpVerify.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationLifecycleSet } from "../../src/features/organizations/actions/organizationLifecycleSet.js"
import { organizationLoginContextResolve } from "../../src/features/organizations/server/organizationLoginContextResolve.js"
import { organizationLoginContextValidate } from "../../src/features/organizations/server/organizationLoginContextValidate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { realmUpdate } from "../../src/features/realms/actions/realmUpdate.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-organization-login-context-"))
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

test("organization login context rejects inactive, wrong-realm, and mismatched contexts", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const realm = realmCreate({
      context: system,
      database,
      input: { domain: "context.example.com", name: "Context" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const organization = organizationCreate({
      context: system,
      database,
      input: { name: "Context organization" },
      realmId: realm.data.realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const resolved = organizationLoginContextResolve({
      executor: database.db,
      organizationId: organization.data.organization.id,
      realmId: realm.data.realm.id,
    })
    expect(resolved).toEqual({
      success: true,
      data: { organizationId: organization.data.organization.id, realmId: realm.data.realm.id },
    })
    const mismatched = organizationLoginContextValidate({
      context: resolved.success ? resolved.data : { realmId: realm.data.realm.id },
      executor: database.db,
      expectedOrganizationId: "018bcfe5-6800-7010-9010-101010101010",
      expectedRealmId: realm.data.realm.id,
    })
    expect(mismatched.success).toBe(false)
    const inactive = organizationLifecycleSet({
      context: system,
      database,
      input: { status: "inactive" },
      organizationId: organization.data.organization.id,
      realmId: realm.data.realm.id,
    })
    expect(inactive.success).toBe(true)
    expect(
      organizationLoginContextResolve({
        executor: database.db,
        organizationId: organization.data.organization.id,
        realmId: realm.data.realm.id,
      }).success,
    ).toBe(false)
    const disabledRealm = realmUpdate({
      context: system,
      database,
      input: { status: "disabled" },
      realmId: realm.data.realm.id,
    })
    expect(disabledRealm.success).toBe(true)
    expect(organizationLoginContextResolve({ executor: database.db, realmId: realm.data.realm.id }).success).toBe(false)
  })
})

test("session organization context is retained and revalidated at authentication", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const realm = realmCreate({
      context: system,
      database,
      input: { domain: "session-context.example.com", name: "Session context" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const user = userCreate({
      context: system,
      database,
      input: { email: "context@example.com", profile: {}, userName: "context-user" },
      realmId: realm.data.realm.id,
    })
    expect(user.success).toBe(true)
    if (!user.success) return
    const active = userLifecycleSet({
      context: system,
      database,
      input: { state: "active" },
      realmId: realm.data.realm.id,
      userId: user.data.user.id,
    })
    expect(active.success).toBe(true)
    const organization = organizationCreate({
      context: system,
      database,
      input: { name: "Session organization", ownerUserId: user.data.user.id },
      realmId: realm.data.realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      organizationId: organization.data.organization.id,
      realmId: realm.data.realm.id,
      userId: user.data.user.id,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return
    expect(issued.data.session.organizationId).toBe(organization.data.organization.id)
    expect(sessionAuthenticate({ database, realmId: realm.data.realm.id, token: issued.data.token }).success).toBe(true)
    const inactive = organizationLifecycleSet({
      context: system,
      database,
      input: { status: "inactive" },
      organizationId: organization.data.organization.id,
      realmId: realm.data.realm.id,
    })
    expect(inactive.success).toBe(true)
    expect(sessionAuthenticate({ database, realmId: realm.data.realm.id, token: issued.data.token }).success).toBe(
      false,
    )
  })
})

test("email OTP retains the server-validated organization context through completion", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const realm = realmCreate({
      context: system,
      database,
      input: { domain: "otp-context.example.com", name: "OTP context" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const context = realmTenantContextCreate(realm.data.realm.id, "anonymous")
    let verificationToken = ""
    const registered = passwordRegister({
      context,
      database,
      input: {
        email: "otp-context@example.com",
        password: "Correct Horse 12",
        profile: {},
        userName: "otp-context-user",
      },
      realmId: realm.data.realm.id,
      onVerificationToken: ({ token }) => {
        verificationToken = token
      },
    })
    expect(registered.success).toBe(true)
    const verified = passwordEmailVerify({
      context,
      database,
      input: { token: verificationToken },
      realmId: realm.data.realm.id,
    })
    expect(verified.success).toBe(true)
    if (!verified.success) return
    const organization = organizationCreate({
      context: system,
      database,
      input: { name: "OTP organization", ownerUserId: verified.data.user.id },
      realmId: realm.data.realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    let delivery: { readonly challengeId: string; readonly code: string } | undefined
    const started = emailOtpStart({
      context,
      database,
      input: { email: "otp-context@example.com", organizationId: organization.data.organization.id },
      realmId: realm.data.realm.id,
      onDelivery: (value) => {
        delivery = value
      },
    })
    expect(started.success).toBe(true)
    if (!started.success || delivery === undefined) return
    const inactive = organizationLifecycleSet({
      context: system,
      database,
      input: { status: "inactive" },
      organizationId: organization.data.organization.id,
      realmId: realm.data.realm.id,
    })
    expect(inactive.success).toBe(true)
    const completed = emailOtpVerify({
      context,
      database,
      input: { challengeId: delivery.challengeId, code: delivery.code },
      realmId: realm.data.realm.id,
    })
    expect(completed.success).toBe(false)
  })
})

import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userPhoneNumberChange } from "../../src/features/users/actions/userPhoneNumberChange.js"
import { userEventTypes } from "../../src/features/users/events/userEventTypes.js"
import { userPhoneNumberChangedEventPayloadSchema } from "../../src/features/users/events/userPhoneNumberChangedEventPayloadSchema.js"
import { userRepositoryCreate } from "../../src/features/users/persistence/userRepositoryCreate.js"
import { whatsappOtpPhoneChangeResend } from "../../src/features/whatsappOtp/actions/whatsappOtpPhoneChangeResend.js"
import { whatsappOtpPhoneChangeStart } from "../../src/features/whatsappOtp/actions/whatsappOtpPhoneChangeStart.js"
import { whatsappOtpPhoneChangeVerify } from "../../src/features/whatsappOtp/actions/whatsappOtpPhoneChangeVerify.js"
import type { WhatsappOtpAvailabilityPort } from "../../src/features/whatsappOtp/domain/whatsappOtpAvailabilityPort.js"
import { whatsappOtpPhoneChangePurpose } from "../../src/features/whatsappOtp/domain/whatsappOtpPhoneChangePurpose.js"
import { whatsappOtpPhoneHashCreate } from "../../src/features/whatsappOtp/domain/whatsappOtpPhoneHashCreate.js"
import { whatsappOtpRepositoryCreate } from "../../src/features/whatsappOtp/persistence/whatsappOtpRepositoryCreate.js"
import { whatsappOtpPhoneChangeResendRequestSchema } from "../../src/features/whatsappOtp/public/whatsappOtpPhoneChangeResendRequestSchema.js"
import { whatsappOtpPhoneChangeStartRequestSchema } from "../../src/features/whatsappOtp/public/whatsappOtpPhoneChangeStartRequestSchema.js"
import { whatsappOtpPhoneChangeVerifyRequestSchema } from "../../src/features/whatsappOtp/public/whatsappOtpPhoneChangeVerifyRequestSchema.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-account-phone-change-"))
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

const available: WhatsappOtpAvailabilityPort = {
  whatsappOtpAvailabilityGet: () => ({ data: { available: true }, success: true }),
}

async function createAuthenticatedPhoneUser(
  database: StorageDatabase,
  email: string,
  phoneNumber: string,
  existingRealm?: { readonly id: string },
) {
  const realm =
    existingRealm ??
    (() => {
      const created = realmCreate({
        context: realmSystemContextCreate(),
        database,
        input: { domain: `${email.replace("@", "-")}.example.com`, name: email },
      })
      expect(created.success).toBe(true)
      if (!created.success) throw new Error(created.errorMessage)
      return created.data.realm
    })()
  const created = userCreate({
    context: realmSystemContextCreate(),
    database,
    input: { email, phoneNumber, profile: {}, userName: email.split("@")[0] ?? "phone-user" },
    realmId: realm.id,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const repository = userRepositoryCreate(database.db)
  const current = repository.userGet(realm.id, created.data.user.id)
  expect(current.success).toBe(true)
  if (!current.success || current.data === null) throw new Error("The phone user was not created")
  const updated = repository.userUpdate(realm.id, created.data.user.id, {
    phoneNumberVerifiedAt: database.runtime.now(),
    state: "active",
    updatedAt: database.runtime.now(),
    version: current.data.version + 1,
  })
  expect(updated.success).toBe(true)
  return {
    context: realmTenantContextCreate(realm.id, created.data.user.id),
    realm,
    userId: created.data.user.id,
  }
}

test("account phone-change contracts are strict and require a candidate E.164 number", () => {
  expect(v.safeParse(whatsappOtpPhoneChangeStartRequestSchema, { phoneNumber: "+14155552671" }).success).toBe(true)
  expect(v.safeParse(whatsappOtpPhoneChangeStartRequestSchema, { phoneNumber: "4155552671" }).success).toBe(false)
  expect(
    v.safeParse(whatsappOtpPhoneChangeResendRequestSchema, {
      challengeId: "challenge",
      phoneNumber: "+14155552671",
    }).success,
  ).toBe(true)
  expect(
    v.safeParse(whatsappOtpPhoneChangeVerifyRequestSchema, {
      challengeId: "challenge",
      code: "123456",
      phoneNumber: "+14155552671",
    }).success,
  ).toBe(true)
  expect(
    v.safeParse(whatsappOtpPhoneChangeVerifyRequestSchema, {
      challengeId: "challenge",
      code: "123456",
      organizationId: "unexpected",
      phoneNumber: "+14155552671",
    }).success,
  ).toBe(false)
})

test("phone-change challenges are bound to the user, candidate hash, realm, and dedicated purpose", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "account-phone-change.example.com", name: "Account phone change" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const user = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: { email: "phone-change@example.com", profile: {}, userName: "phone-change" },
      realmId: realm.data.realm.id,
    })
    expect(user.success).toBe(true)
    if (!user.success) return
    const repository = whatsappOtpRepositoryCreate(database.db)
    const created = repository.whatsappOtpPhoneChangeChallengeCreate({
      attempts: 0,
      codeHash: "code-hash",
      consumedAt: null,
      cooldownUntil: 1_700_000_000_060,
      createdAt: 1_700_000_000_000,
      expiresAt: 1_700_000_000_600,
      id: "phone-change-challenge",
      maxAttempts: 5,
      phoneHash: whatsappOtpPhoneHashCreate("+14155552671"),
      realmId: realm.data.realm.id,
      userId: user.data.user.id,
      version: 1,
    })
    expect(created).toMatchObject({ success: true, data: { purpose: whatsappOtpPhoneChangePurpose } })
    const latest = repository.whatsappOtpPhoneChangeChallengeLatestGet(
      realm.data.realm.id,
      user.data.user.id,
      whatsappOtpPhoneHashCreate("+14155552671"),
    )
    expect(latest).toMatchObject({ success: true, data: { id: "phone-change-challenge" } })
    expect(
      repository.whatsappOtpPhoneChangeChallengeGet(realm.data.realm.id, "another-user", "phone-change-challenge"),
    ).toEqual({ data: null, success: true })
    expect(
      database.sqlite.query("SELECT purpose, user_id, organization_id FROM whatsapp_otp_challenges").get(),
    ).toEqual({ organization_id: null, purpose: whatsappOtpPhoneChangePurpose, user_id: user.data.user.id })
  })
})

test("verified phone replacement updates the user and redacted event atomically", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "account-phone-change-atomic.example.com", name: "Account phone change atomic" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const first = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: { email: "first@example.com", phoneNumber: "+14155552671", profile: {}, userName: "first" },
      realmId: realm.data.realm.id,
    })
    const second = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: { email: "second@example.com", phoneNumber: "+14155552672", profile: {}, userName: "second" },
      realmId: realm.data.realm.id,
    })
    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    if (!first.success || !second.success) return
    const repository = userRepositoryCreate(database.db)
    expect(
      repository.userUpdate(realm.data.realm.id, first.data.user.id, {
        phoneNumberVerifiedAt: database.runtime.now(),
        version: 2,
      }).success,
    ).toBe(true)
    expect(
      repository.userUpdate(realm.data.realm.id, second.data.user.id, {
        phoneNumberVerifiedAt: database.runtime.now(),
        version: 2,
      }).success,
    ).toBe(true)
    const changed = userPhoneNumberChange({
      context: realmSystemContextCreate("account-user"),
      database,
      input: { phoneNumber: "+14155552672" },
      realmId: realm.data.realm.id,
      userId: first.data.user.id,
    })
    expect(changed.success).toBe(false)
    expect(repository.userGet(realm.data.realm.id, first.data.user.id)).toMatchObject({
      success: true,
      data: { phoneNumber: "+14155552671" },
    })
    expect(
      database.sqlite
        .query("SELECT COUNT(*) AS count FROM events WHERE event_type = ?")
        .get(userEventTypes.phoneNumberChanged),
    ).toEqual({ count: 0 })

    const successful = userPhoneNumberChange({
      context: realmSystemContextCreate("account-user"),
      database,
      input: { phoneNumber: "+14155552673" },
      realmId: realm.data.realm.id,
      userId: first.data.user.id,
    })
    expect(successful).toMatchObject({ success: true, data: { user: { phoneNumber: "+14155552673" } } })
    const event = database.sqlite
      .query(
        "SELECT aggregate_version, event_type, payload FROM events WHERE aggregate_id = ? ORDER BY aggregate_version DESC",
      )
      .get(first.data.user.id) as { aggregate_version: number; event_type: string; payload: string }
    expect(event).toMatchObject({ aggregate_version: 3, event_type: userEventTypes.phoneNumberChanged })
    const payload = v.safeParse(userPhoneNumberChangedEventPayloadSchema, JSON.parse(event.payload))
    expect(payload.success).toBe(true)
    if (payload.success) expect(payload.output).toEqual({ verified: true })
    expect(event.payload).not.toContain("+14155552673")

    database.sqlite.run(
      `CREATE TRIGGER reject_phone_change_events BEFORE INSERT ON events WHEN NEW.event_type = '${userEventTypes.phoneNumberChanged}' BEGIN SELECT RAISE(ABORT, 'event rejected'); END`,
    )
    const rolledBack = userPhoneNumberChange({
      context: realmSystemContextCreate("account-user"),
      database,
      input: { phoneNumber: "+14155552674" },
      realmId: realm.data.realm.id,
      userId: first.data.user.id,
    })
    expect(rolledBack.success).toBe(false)
    expect(repository.userGet(realm.data.realm.id, first.data.user.id)).toMatchObject({
      success: true,
      data: { phoneNumber: "+14155552673" },
    })
    expect(
      database.sqlite
        .query("SELECT COUNT(*) AS count FROM events WHERE event_type = ?")
        .get(userEventTypes.phoneNumberChanged),
    ).toEqual({ count: 1 })
  })
})

test("authenticated phone-change actions bind the challenge and issue no session", async () => {
  await withDatabase(async (database) => {
    const first = await createAuthenticatedPhoneUser(database, "action-first@example.com", "+14155552671")
    const second = await createAuthenticatedPhoneUser(
      database,
      "action-second@example.com",
      "+14155552672",
      first.realm,
    )
    const candidate = "+14155552673"
    let firstDelivery: { challengeId: string; code: string } | undefined
    const started = whatsappOtpPhoneChangeStart({
      availability: available,
      context: first.context,
      database,
      input: { phoneNumber: candidate },
      onDelivery: ({ challengeId, code }) => {
        firstDelivery = { challengeId, code }
      },
      rateLimitSecret: "account-phone-action-secret",
      realmId: first.realm.id,
      userId: first.userId,
    })
    expect(started.success).toBe(true)
    expect(firstDelivery).toBeDefined()
    if (!started.success || firstDelivery === undefined) return

    const wrongUser = whatsappOtpPhoneChangeVerify({
      availability: available,
      context: second.context,
      database,
      input: { challengeId: firstDelivery.challengeId, code: firstDelivery.code, phoneNumber: candidate },
      rateLimitSecret: "account-phone-action-secret",
      realmId: second.realm.id,
      userId: second.userId,
    })
    expect(wrongUser).toMatchObject({ code: "whatsapp-otp.invalid", success: false })
    expect(
      database.sqlite
        .query("SELECT consumed_at FROM whatsapp_otp_challenges WHERE id = ?")
        .get(firstDelivery.challengeId),
    ).toEqual({ consumed_at: null })

    const verified = whatsappOtpPhoneChangeVerify({
      availability: available,
      context: first.context,
      database,
      input: { challengeId: firstDelivery.challengeId, code: firstDelivery.code, phoneNumber: candidate },
      rateLimitSecret: "account-phone-action-secret",
      realmId: first.realm.id,
      userId: first.userId,
    })
    expect(verified).toMatchObject({ success: true, data: { user: { phoneNumber: candidate } } })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 0 })
  })
})

test("phone-change resend delivers a replacement and conflicts preserve the old phone", async () => {
  await withDatabase(async (database) => {
    const first = await createAuthenticatedPhoneUser(database, "conflict-first@example.com", "+14155552674")
    const second = await createAuthenticatedPhoneUser(
      database,
      "conflict-second@example.com",
      "+14155552675",
      first.realm,
    )
    const candidate = "+14155552675"
    let firstDelivery: { challengeId: string; code: string } | undefined
    const started = whatsappOtpPhoneChangeStart({
      availability: available,
      context: first.context,
      database,
      input: { phoneNumber: candidate },
      onDelivery: ({ challengeId, code }) => {
        firstDelivery = { challengeId, code }
      },
      rateLimitSecret: "account-phone-conflict-secret",
      realmId: first.realm.id,
      userId: first.userId,
    })
    expect(started.success).toBe(true)
    expect(firstDelivery).toBeDefined()
    if (!started.success || firstDelivery === undefined) return

    const resentDelivery: { challengeId: string; code: string }[] = []
    const resent = whatsappOtpPhoneChangeResend({
      availability: available,
      context: first.context,
      database,
      input: { challengeId: firstDelivery.challengeId, phoneNumber: candidate },
      onDelivery: ({ challengeId, code }) => {
        resentDelivery.push({ challengeId, code })
      },
      rateLimitSecret: "account-phone-conflict-secret",
      realmId: first.realm.id,
      userId: first.userId,
    })
    expect(resent.success).toBe(true)
    expect(resentDelivery).toHaveLength(0)

    database.sqlite.query("UPDATE whatsapp_otp_challenges SET cooldown_until = 0 WHERE user_id = ?").run(first.userId)
    const replacement = whatsappOtpPhoneChangeResend({
      availability: available,
      context: first.context,
      database,
      input: { challengeId: firstDelivery.challengeId, phoneNumber: candidate },
      onDelivery: ({ challengeId, code }) => {
        resentDelivery.push({ challengeId, code })
      },
      rateLimitSecret: "account-phone-conflict-secret",
      realmId: first.realm.id,
      userId: first.userId,
    })
    expect(replacement.success).toBe(true)
    expect(resentDelivery).toHaveLength(1)
    if (!replacement.success || resentDelivery[0] === undefined) return

    const conflict = whatsappOtpPhoneChangeVerify({
      availability: available,
      context: first.context,
      database,
      input: { challengeId: resentDelivery[0].challengeId, code: resentDelivery[0].code, phoneNumber: candidate },
      rateLimitSecret: "account-phone-conflict-secret",
      realmId: first.realm.id,
      userId: first.userId,
    })
    expect(conflict).toMatchObject({ code: "users.conflict", success: false })
    expect(userRepositoryCreate(database.db).userGet(first.realm.id, first.userId)).toMatchObject({
      success: true,
      data: { phoneNumber: "+14155552674" },
    })
    expect(userRepositoryCreate(database.db).userGet(second.realm.id, second.userId)).toMatchObject({
      success: true,
      data: { phoneNumber: candidate },
    })
  })
})

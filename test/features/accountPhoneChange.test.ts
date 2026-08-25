import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userPhoneNumberChange } from "../../src/features/users/actions/userPhoneNumberChange.js"
import { userPhoneNumberChangedEventPayloadSchema } from "../../src/features/users/events/userPhoneNumberChangedEventPayloadSchema.js"
import { userEventTypes } from "../../src/features/users/events/userEventTypes.js"
import { userRepositoryCreate } from "../../src/features/users/persistence/userRepositoryCreate.js"
import { whatsappOtpPhoneHashCreate } from "../../src/features/whatsappOtp/domain/whatsappOtpPhoneHashCreate.js"
import { whatsappOtpPhoneChangePurpose } from "../../src/features/whatsappOtp/domain/whatsappOtpPhoneChangePurpose.js"
import { whatsappOtpPhoneChangeStartRequestSchema } from "../../src/features/whatsappOtp/public/whatsappOtpPhoneChangeStartRequestSchema.js"
import { whatsappOtpPhoneChangeVerifyRequestSchema } from "../../src/features/whatsappOtp/public/whatsappOtpPhoneChangeVerifyRequestSchema.js"
import { whatsappOtpRepositoryCreate } from "../../src/features/whatsappOtp/persistence/whatsappOtpRepositoryCreate.js"
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

test("account phone-change contracts are strict and require a candidate E.164 number", () => {
  expect(v.safeParse(whatsappOtpPhoneChangeStartRequestSchema, { phoneNumber: "+14155552671" }).success).toBe(true)
  expect(v.safeParse(whatsappOtpPhoneChangeStartRequestSchema, { phoneNumber: "4155552671" }).success).toBe(false)
  expect(
    v.safeParse(whatsappOtpPhoneChangeVerifyRequestSchema, { challengeId: "challenge", code: "123456" }).success,
  ).toBe(true)
  expect(
    v.safeParse(whatsappOtpPhoneChangeVerifyRequestSchema, {
      challengeId: "challenge",
      code: "123456",
      organizationId: "unexpected",
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
  })
})

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
import { whatsappOtpEventTypes } from "../../src/features/whatsappOtp/events/whatsappOtpEventTypes.js"
import { whatsappOtpFailedEventPayloadSchema } from "../../src/features/whatsappOtp/events/whatsappOtpFailedEventPayloadSchema.js"
import { whatsappOtpRepositoryCreate } from "../../src/features/whatsappOtp/persistence/whatsappOtpRepositoryCreate.js"
import { whatsappOtpPhoneChangeResendRequestSchema } from "../../src/features/whatsappOtp/public/whatsappOtpPhoneChangeResendRequestSchema.js"
import { whatsappOtpPhoneChangeStartRequestSchema } from "../../src/features/whatsappOtp/public/whatsappOtpPhoneChangeStartRequestSchema.js"
import { whatsappOtpPhoneChangeVerifyRequestSchema } from "../../src/features/whatsappOtp/public/whatsappOtpPhoneChangeVerifyRequestSchema.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-account-phone-change-"))
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

async function withDatabasePair<T>(
  operation: (
    first: StorageDatabase,
    second: StorageDatabase,
    testkit: ReturnType<typeof platformTestkitCreate>,
  ) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-account-phone-change-pair-"))
  const testkit = platformTestkitCreate()
  const path = join(directory, "authworks.sqlite")
  const first = storageDatabaseOpen(path, testkit.runtime)
  expect(first.success).toBe(true)
  if (!first.success) throw new Error(first.errorMessage)
  const second = storageDatabaseOpen(path, testkit.runtime)
  expect(second.success).toBe(true)
  if (!second.success) {
    first.data.close()
    throw new Error(second.errorMessage)
  }
  try {
    return await operation(first.data, second.data, testkit)
  } finally {
    first.data.close()
    second.data.close()
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

test("phone-change expiry consumes the challenge without changing the active phone", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createAuthenticatedPhoneUser(database, "expiry@example.com", "+14155552671")
    let delivery: { challengeId: string; code: string } | undefined
    const started = whatsappOtpPhoneChangeStart({
      availability: available,
      context: fixture.context,
      database,
      input: { phoneNumber: "+14155552672" },
      onDelivery: ({ challengeId, code }) => {
        delivery = { challengeId, code }
      },
      rateLimitSecret: "account-phone-expiry-secret",
      realmId: fixture.realm.id,
      userId: fixture.userId,
    })
    expect(started.success).toBe(true)
    expect(delivery).toBeDefined()
    if (!started.success || delivery === undefined) return

    const expiresAt = started.data.expiresAt
    testkit.advance(expiresAt - testkit.runtime.now())
    const expired = whatsappOtpPhoneChangeVerify({
      availability: available,
      context: fixture.context,
      database,
      input: { challengeId: delivery.challengeId, code: delivery.code, phoneNumber: "+14155552672" },
      rateLimitSecret: "account-phone-expiry-secret",
      realmId: fixture.realm.id,
      userId: fixture.userId,
    })
    expect(expired).toMatchObject({ code: "whatsapp-otp.invalid", success: false })
    expect(
      database.sqlite
        .query("SELECT attempts, consumed_at FROM whatsapp_otp_challenges WHERE id = ?")
        .get(delivery.challengeId),
    ).toEqual({ attempts: 0, consumed_at: expiresAt })
    const event = database.sqlite
      .query("SELECT payload FROM events WHERE aggregate_id = ? AND event_type = ?")
      .get(delivery.challengeId, whatsappOtpEventTypes.failed) as { payload: string }
    const payload = v.safeParse(whatsappOtpFailedEventPayloadSchema, JSON.parse(event.payload))
    expect(payload).toMatchObject({ success: true, output: { attempts: 0, exhausted: false, reason: "expired" } })
    expect(userRepositoryCreate(database.db).userGet(fixture.realm.id, fixture.userId)).toMatchObject({
      success: true,
      data: { phoneNumber: "+14155552671" },
    })
  })
})

test("phone-change attempts exhaust the challenge and reject the correct code", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createAuthenticatedPhoneUser(database, "exhaustion@example.com", "+14155552671")
    let delivery: { challengeId: string; code: string } | undefined
    const started = whatsappOtpPhoneChangeStart({
      availability: available,
      context: fixture.context,
      database,
      input: { phoneNumber: "+14155552672" },
      onDelivery: ({ challengeId, code }) => {
        delivery = { challengeId, code }
      },
      rateLimitSecret: "account-phone-exhaustion-secret",
      realmId: fixture.realm.id,
      userId: fixture.userId,
    })
    expect(started.success).toBe(true)
    expect(delivery).toBeDefined()
    if (delivery === undefined) return
    const invalidCode = delivery.code === "000000" ? "111111" : "000000"
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        whatsappOtpPhoneChangeVerify({
          availability: available,
          clientIp: `192.0.2.${140 + attempt}`,
          context: fixture.context,
          database,
          input: { challengeId: delivery.challengeId, code: invalidCode, phoneNumber: "+14155552672" },
          rateLimitSecret: "account-phone-exhaustion-secret",
          realmId: fixture.realm.id,
          userId: fixture.userId,
        }),
      ).toMatchObject({ code: "whatsapp-otp.invalid", success: false })
    }
    const exhaustedAt = database.runtime.now()
    expect(
      database.sqlite
        .query("SELECT attempts, consumed_at FROM whatsapp_otp_challenges WHERE id = ?")
        .get(delivery.challengeId),
    ).toEqual({ attempts: 5, consumed_at: exhaustedAt })

    testkit.advance(60_000)
    const correctAfterExhaustion = whatsappOtpPhoneChangeVerify({
      availability: available,
      context: fixture.context,
      database,
      input: { challengeId: delivery.challengeId, code: delivery.code, phoneNumber: "+14155552672" },
      rateLimitSecret: "account-phone-exhaustion-secret",
      realmId: fixture.realm.id,
      userId: fixture.userId,
    })
    expect(correctAfterExhaustion).toMatchObject({ code: "whatsapp-otp.invalid", success: false })
    expect(
      database.sqlite
        .query("SELECT attempts, consumed_at FROM whatsapp_otp_challenges WHERE id = ?")
        .get(delivery.challengeId),
    ).toEqual({ attempts: 5, consumed_at: exhaustedAt })
    expect(userRepositoryCreate(database.db).userGet(fixture.realm.id, fixture.userId)).toMatchObject({
      success: true,
      data: { phoneNumber: "+14155552671" },
    })
  })
})

test("phone-change verification is one-time and replay cannot mutate the phone twice", async () => {
  await withDatabase(async (database) => {
    const fixture = await createAuthenticatedPhoneUser(database, "replay@example.com", "+14155552671")
    let delivery: { challengeId: string; code: string } | undefined
    const started = whatsappOtpPhoneChangeStart({
      availability: available,
      context: fixture.context,
      database,
      input: { phoneNumber: "+14155552672" },
      onDelivery: ({ challengeId, code }) => {
        delivery = { challengeId, code }
      },
      rateLimitSecret: "account-phone-replay-secret",
      realmId: fixture.realm.id,
      userId: fixture.userId,
    })
    expect(started.success).toBe(true)
    expect(delivery).toBeDefined()
    if (delivery === undefined) return

    const verified = whatsappOtpPhoneChangeVerify({
      availability: available,
      context: fixture.context,
      database,
      input: { challengeId: delivery.challengeId, code: delivery.code, phoneNumber: "+14155552672" },
      rateLimitSecret: "account-phone-replay-secret",
      realmId: fixture.realm.id,
      userId: fixture.userId,
    })
    const replay = whatsappOtpPhoneChangeVerify({
      availability: available,
      context: fixture.context,
      database,
      input: { challengeId: delivery.challengeId, code: delivery.code, phoneNumber: "+14155552672" },
      rateLimitSecret: "account-phone-replay-secret",
      realmId: fixture.realm.id,
      userId: fixture.userId,
    })
    expect(verified).toMatchObject({ success: true, data: { user: { phoneNumber: "+14155552672" } } })
    expect(replay).toMatchObject({ code: "whatsapp-otp.invalid", success: false })
    expect(
      database.sqlite
        .query("SELECT COUNT(*) AS count FROM events WHERE event_type = ?")
        .get(userEventTypes.phoneNumberChanged),
    ).toEqual({ count: 1 })
  })
})

test("concurrent phone-change verification has one winner and one phone event", async () => {
  await withDatabasePair(async (first, second, testkit) => {
    const fixture = await createAuthenticatedPhoneUser(first, "concurrent@example.com", "+14155552671")
    let delivery: { challengeId: string; code: string } | undefined
    const started = whatsappOtpPhoneChangeStart({
      availability: available,
      context: fixture.context,
      database: first,
      input: { phoneNumber: "+14155552672" },
      onDelivery: ({ challengeId, code }) => {
        delivery = { challengeId, code }
      },
      rateLimitSecret: "account-phone-concurrent-secret",
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(started.success).toBe(true)
    expect(delivery).toBeDefined()
    if (delivery === undefined) return
    const currentDelivery = delivery
    const verify = (database: StorageDatabase, clientIp: string) =>
      whatsappOtpPhoneChangeVerify({
        availability: available,
        clientIp,
        context: fixture.context,
        database,
        input: { challengeId: currentDelivery.challengeId, code: currentDelivery.code, phoneNumber: "+14155552672" },
        rateLimitSecret: "account-phone-concurrent-secret",
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      })
    const verification = await Promise.all([
      new Promise<ReturnType<typeof verify>>((resolve, reject) =>
        setTimeout(() => {
          try {
            resolve(verify(first, "192.0.2.150"))
          } catch (error) {
            reject(error)
          }
        }, 0),
      ),
      new Promise<ReturnType<typeof verify>>((resolve, reject) =>
        setTimeout(() => {
          try {
            resolve(verify(second, "192.0.2.151"))
          } catch (error) {
            reject(error)
          }
        }, 0),
      ),
    ])
    expect(verification.filter((result) => result.success)).toHaveLength(1)
    expect(verification.filter((result) => !result.success)).toHaveLength(1)
    expect(verification.find((result) => !result.success)).toMatchObject({
      code: "whatsapp-otp.invalid",
      success: false,
    })
    expect(userRepositoryCreate(first.db).userGet(fixture.realm.id, fixture.userId)).toMatchObject({
      success: true,
      data: { phoneNumber: "+14155552672" },
    })
    expect(
      first.sqlite
        .query("SELECT COUNT(*) AS count FROM events WHERE event_type = ?")
        .get(userEventTypes.phoneNumberChanged),
    ).toEqual({ count: 1 })
  })
})

test("unavailable phone-change starts consume request limits without creating a challenge", async () => {
  await withDatabase(async (database) => {
    const fixture = await createAuthenticatedPhoneUser(database, "unavailable-start@example.com", "+14155552671")
    const unavailable: WhatsappOtpAvailabilityPort = {
      whatsappOtpAvailabilityGet: () => ({ data: { available: false }, success: true }),
    }
    const start = () =>
      whatsappOtpPhoneChangeStart({
        availability: unavailable,
        clientIp: "192.0.2.160",
        context: fixture.context,
        database,
        input: { phoneNumber: "+14155552672" },
        rateLimitSecret: "account-phone-unavailable-secret",
        realmId: fixture.realm.id,
        userId: fixture.userId,
      })
    for (let request = 0; request < 5; request += 1)
      expect(start()).toMatchObject({ code: "whatsapp-otp.unavailable", success: false })
    expect(start()).toMatchObject({ code: "whatsapp-otp.rate-limited", success: false })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM whatsapp_otp_challenges").get()).toEqual({ count: 0 })
    expect(
      database.sqlite
        .query(
          "SELECT scope, SUM(count) AS requests FROM rate_limits WHERE scope LIKE 'whatsapp-otp.phone_change_start.%' GROUP BY scope ORDER BY scope",
        )
        .all(),
    ).toEqual([
      { scope: "whatsapp-otp.phone_change_start.identifier", requests: 6 },
      { scope: "whatsapp-otp.phone_change_start.ip", requests: 6 },
    ])
  })
})

test("unavailable phone-change resend and verify consume request limits without changing the challenge", async () => {
  await withDatabase(async (database) => {
    const fixture = await createAuthenticatedPhoneUser(database, "unavailable-followup@example.com", "+14155552671")
    let delivery: { challengeId: string; code: string } | undefined
    const started = whatsappOtpPhoneChangeStart({
      availability: available,
      context: fixture.context,
      database,
      input: { phoneNumber: "+14155552672" },
      onDelivery: ({ challengeId, code }) => {
        delivery = { challengeId, code }
      },
      rateLimitSecret: "account-phone-unavailable-followup-secret",
      realmId: fixture.realm.id,
      userId: fixture.userId,
    })
    expect(started.success).toBe(true)
    expect(delivery).toBeDefined()
    if (delivery === undefined) return
    const currentDelivery = delivery
    const unavailable: WhatsappOtpAvailabilityPort = {
      whatsappOtpAvailabilityGet: () => ({ data: { available: false }, success: true }),
    }
    const resend = () =>
      whatsappOtpPhoneChangeResend({
        availability: unavailable,
        clientIp: "192.0.2.161",
        context: fixture.context,
        database,
        input: { challengeId: currentDelivery.challengeId, phoneNumber: "+14155552672" },
        rateLimitSecret: "account-phone-unavailable-followup-secret",
        realmId: fixture.realm.id,
        userId: fixture.userId,
      })
    const verify = () =>
      whatsappOtpPhoneChangeVerify({
        availability: unavailable,
        clientIp: "192.0.2.162",
        context: fixture.context,
        database,
        input: { challengeId: currentDelivery.challengeId, code: currentDelivery.code, phoneNumber: "+14155552672" },
        rateLimitSecret: "account-phone-unavailable-followup-secret",
        realmId: fixture.realm.id,
        userId: fixture.userId,
      })
    for (let request = 0; request < 5; request += 1) {
      expect(resend()).toMatchObject({ code: "whatsapp-otp.unavailable", success: false })
      expect(verify()).toMatchObject({ code: "whatsapp-otp.unavailable", success: false })
    }
    expect(resend()).toMatchObject({ code: "whatsapp-otp.rate-limited", success: false })
    expect(verify()).toMatchObject({ code: "whatsapp-otp.rate-limited", success: false })
    expect(
      database.sqlite
        .query("SELECT consumed_at, attempts FROM whatsapp_otp_challenges WHERE id = ?")
        .get(delivery.challengeId),
    ).toEqual({ attempts: 0, consumed_at: null })
    expect(
      database.sqlite
        .query(
          "SELECT scope, SUM(count) AS requests FROM rate_limits WHERE scope LIKE 'whatsapp-otp.phone_change_%' GROUP BY scope ORDER BY scope",
        )
        .all(),
    ).toEqual([
      { scope: "whatsapp-otp.phone_change_resend.identifier", requests: 6 },
      { scope: "whatsapp-otp.phone_change_resend.ip", requests: 6 },
      { scope: "whatsapp-otp.phone_change_start.identifier", requests: 1 },
      { scope: "whatsapp-otp.phone_change_start.ip", requests: 1 },
      { scope: "whatsapp-otp.phone_change_verify.identifier", requests: 6 },
      { scope: "whatsapp-otp.phone_change_verify.ip", requests: 6 },
    ])
  })
})

test("phone-change delivery failure leaves the committed challenge verifiable", async () => {
  await withDatabase(async (database) => {
    const fixture = await createAuthenticatedPhoneUser(database, "delivery-failure@example.com", "+14155552671")
    let delivery: { challengeId: string; code: string } | undefined
    let deliveryCalls = 0
    const started = whatsappOtpPhoneChangeStart({
      availability: available,
      context: fixture.context,
      database,
      delivery: {
        sendText: async () => {
          deliveryCalls += 1
          return { errorMessage: "WhatsApp is offline.", op: "fakeDelivery", success: false as const }
        },
      },
      input: { phoneNumber: "+14155552672" },
      onDelivery: ({ challengeId, code }) => {
        delivery = { challengeId, code }
      },
      rateLimitSecret: "account-phone-delivery-failure-secret",
      realmId: fixture.realm.id,
      userId: fixture.userId,
    })
    expect(started).toMatchObject({ success: true, data: { accepted: true } })
    expect(delivery).toBeDefined()
    await Promise.resolve()
    expect(deliveryCalls).toBe(1)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM whatsapp_otp_challenges").get()).toEqual({ count: 1 })
    if (delivery === undefined) return
    expect(
      whatsappOtpPhoneChangeVerify({
        availability: available,
        context: fixture.context,
        database,
        input: { challengeId: delivery.challengeId, code: delivery.code, phoneNumber: "+14155552672" },
        rateLimitSecret: "account-phone-delivery-failure-secret",
        realmId: fixture.realm.id,
        userId: fixture.userId,
      }),
    ).toMatchObject({ success: true, data: { user: { phoneNumber: "+14155552672" } } })
  })
})

test("phone-change start, resend, and verify each enforce five-request limits", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createAuthenticatedPhoneUser(database, "request-limits@example.com", "+14155552671")
    let delivery: { challengeId: string; code: string } | undefined
    const start = () =>
      whatsappOtpPhoneChangeStart({
        availability: available,
        clientIp: "192.0.2.170",
        context: fixture.context,
        database,
        input: { phoneNumber: "+14155552672" },
        onDelivery: ({ challengeId, code }) => {
          delivery = { challengeId, code }
        },
        rateLimitSecret: "account-phone-rate-limit-secret",
        realmId: fixture.realm.id,
        userId: fixture.userId,
      })
    const starts = Array.from({ length: 6 }, start)
    expect(starts.filter((result) => result.success)).toHaveLength(5)
    expect(starts.filter((result) => !result.success && result.code === "whatsapp-otp.rate-limited")).toHaveLength(1)
    expect(delivery).toBeDefined()
    if (delivery === undefined) return
    const firstDelivery = delivery
    expect(
      database.sqlite
        .query(
          "SELECT scope, SUM(count) AS requests FROM rate_limits WHERE scope LIKE 'whatsapp-otp.phone_change_start.%' GROUP BY scope ORDER BY scope",
        )
        .all(),
    ).toEqual([
      { scope: "whatsapp-otp.phone_change_start.identifier", requests: 6 },
      { scope: "whatsapp-otp.phone_change_start.ip", requests: 6 },
    ])

    testkit.advance(60_000)
    const resend = () =>
      whatsappOtpPhoneChangeResend({
        availability: available,
        clientIp: "192.0.2.170",
        context: fixture.context,
        database,
        input: { challengeId: firstDelivery.challengeId, phoneNumber: "+14155552672" },
        onDelivery: ({ challengeId, code }) => {
          delivery = { challengeId, code }
        },
        rateLimitSecret: "account-phone-rate-limit-secret",
        realmId: fixture.realm.id,
        userId: fixture.userId,
      })
    const resends = Array.from({ length: 6 }, resend)
    expect(resends.filter((result) => result.success)).toHaveLength(5)
    expect(resends.filter((result) => !result.success && result.code === "whatsapp-otp.rate-limited")).toHaveLength(1)
    expect(delivery).toBeDefined()
    if (delivery === undefined) return
    const replacementDelivery = delivery
    expect(
      database.sqlite
        .query(
          "SELECT scope, SUM(count) AS requests FROM rate_limits WHERE scope LIKE 'whatsapp-otp.phone_change_resend.%' GROUP BY scope ORDER BY scope",
        )
        .all(),
    ).toEqual([
      { scope: "whatsapp-otp.phone_change_resend.identifier", requests: 6 },
      { scope: "whatsapp-otp.phone_change_resend.ip", requests: 6 },
    ])

    testkit.advance(60_000)
    const invalidCode = replacementDelivery.code === "000000" ? "111111" : "000000"
    const verify = () =>
      whatsappOtpPhoneChangeVerify({
        availability: available,
        clientIp: "192.0.2.170",
        context: fixture.context,
        database,
        input: { challengeId: replacementDelivery.challengeId, code: invalidCode, phoneNumber: "+14155552672" },
        rateLimitSecret: "account-phone-rate-limit-secret",
        realmId: fixture.realm.id,
        userId: fixture.userId,
      })
    const verifications = Array.from({ length: 6 }, verify)
    expect(verifications.filter((result) => !result.success && result.code === "whatsapp-otp.invalid")).toHaveLength(5)
    expect(
      verifications.filter((result) => !result.success && result.code === "whatsapp-otp.rate-limited"),
    ).toHaveLength(1)
    expect(
      database.sqlite
        .query(
          "SELECT scope, SUM(count) AS requests FROM rate_limits WHERE scope LIKE 'whatsapp-otp.phone_change_verify.%' GROUP BY scope ORDER BY scope",
        )
        .all(),
    ).toEqual([
      { scope: "whatsapp-otp.phone_change_verify.identifier", requests: 6 },
      { scope: "whatsapp-otp.phone_change_verify.ip", requests: 6 },
    ])
  })
})

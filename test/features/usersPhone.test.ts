import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userEmailVerificationSet } from "../../src/features/users/actions/userEmailVerificationSet.js"
import { userGet } from "../../src/features/users/actions/userGet.js"
import { userPhoneNumberNormalize } from "../../src/features/users/domain/userPhoneNumberNormalize.js"
import { userCreatedEventPayloadSchema } from "../../src/features/users/events/userCreatedEventPayloadSchema.js"
import { userEmailVerificationChangedEventPayloadSchema } from "../../src/features/users/events/userEmailVerificationChangedEventPayloadSchema.js"
import { userEventTypes } from "../../src/features/users/events/userEventTypes.js"
import { userRegistrationVerificationChangedEventPayloadSchema } from "../../src/features/users/events/userRegistrationVerificationChangedEventPayloadSchema.js"
import { userRepositoryCreate } from "../../src/features/users/persistence/userRepositoryCreate.js"
import { userResponseSchema } from "../../src/features/users/public/userResponseSchema.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseReset } from "../../src/platform/storage/storageDatabaseReset.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-users-phone-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(opened.errorMessage)
  }
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function withDatabasePair<T>(operation: (first: StorageDatabase, second: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-users-phone-concurrent-"))
  const path = join(directory, "authworks.sqlite")
  const testkit = platformTestkitCreate()
  const first = storageDatabaseOpen(path, testkit.runtime)
  expect(first.success).toBe(true)
  if (!first.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(first.errorMessage)
  }
  const second = storageDatabaseOpen(path, testkit.runtime)
  expect(second.success).toBe(true)
  if (!second.success) {
    first.data.close()
    await rm(directory, { force: true, recursive: true })
    throw new Error(second.errorMessage)
  }
  try {
    return await operation(first.data, second.data)
  } finally {
    first.data.close()
    second.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function createRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

function createUser(database: StorageDatabase, realmId: string, userName: string, phoneNumber?: string) {
  return userCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: {
      email: `${userName}@example.com`,
      ...(phoneNumber === undefined ? {} : { phoneNumber }),
      profile: { displayName: userName },
      userName,
    },
    realmId,
  })
}

test("phone numbers normalize to E.164 and public user contracts stay row-independent", async () => {
  expect(userPhoneNumberNormalize(" +14155552671 ")).toEqual({ data: "+14155552671", success: true })
  expect(userPhoneNumberNormalize("+1 415 555 2671").success).toBe(false)

  await withDatabase(async (database) => {
    const realm = await createRealm(database, "users-phone-contract.example.com")
    const created = createUser(database, realm.id, "phone-user", " +14155552671 ")
    expect(created.success).toBe(true)
    if (!created.success) return

    expect(created.data.user).toMatchObject({ emailVerified: false, phoneNumber: "+14155552671", state: "initial" })
    expect(created.data.user).not.toHaveProperty("phoneNumberVerifiedAt")
    expect(created.data.user).not.toHaveProperty("registrationVerifiedAt")
    expect(created.data.user).not.toHaveProperty("registrationVerificationMethod")
    expect(v.safeParse(userResponseSchema, { user: created.data.user }).success).toBe(true)

    const row = database.sqlite
      .query(
        "SELECT phone_number, phone_number_verified_at, registration_verified_at, registration_verification_method FROM users WHERE id = ?",
      )
      .get(created.data.user.id)
    expect(row).toEqual({
      phone_number: "+14155552671",
      phone_number_verified_at: null,
      registration_verified_at: null,
      registration_verification_method: null,
    })

    const eventPayload = database.sqlite
      .query("SELECT payload FROM events WHERE aggregate_id = ?")
      .get(created.data.user.id) as { payload: string }
    expect(v.safeParse(userCreatedEventPayloadSchema, JSON.parse(eventPayload.payload)).success).toBe(true)
  })
})

test("verified phone uniqueness is realm scoped and unverified numbers remain reusable", async () => {
  await withDatabase(async (database) => {
    const alpha = await createRealm(database, "users-phone-alpha.example.com")
    const beta = await createRealm(database, "users-phone-beta.example.com")
    const phoneNumber = "+14155552671"
    const first = createUser(database, alpha.id, "first", phoneNumber)
    const second = createUser(database, alpha.id, "second", phoneNumber)
    const otherRealm = createUser(database, beta.id, "other", phoneNumber)
    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(otherRealm.success).toBe(true)
    if (!first.success || !second.success || !otherRealm.success) return

    const repository = userRepositoryCreate(database.db)
    const verified = repository.userUpdate(alpha.id, first.data.user.id, {
      phoneNumberVerifiedAt: database.runtime.now(),
      version: 2,
    })
    expect(verified.success).toBe(true)
    const alphaPhoneUser = repository.userGetByVerifiedPhoneNumber(alpha.id, phoneNumber)
    const betaPhoneUser = repository.userGetByVerifiedPhoneNumber(beta.id, phoneNumber)
    expect(alphaPhoneUser.success).toBe(true)
    expect(betaPhoneUser.success).toBe(true)
    if (!alphaPhoneUser.success || !betaPhoneUser.success) return
    expect(alphaPhoneUser.data?.id).toBe(first.data.user.id)
    expect(betaPhoneUser.data).toBeNull()

    const duplicate = repository.userUpdate(alpha.id, second.data.user.id, {
      phoneNumberVerifiedAt: database.runtime.now(),
      version: 2,
    })
    expect(duplicate).toMatchObject({ code: "users.write-failed", success: false })
    expect(
      repository.userUpdate(beta.id, otherRealm.data.user.id, {
        phoneNumberVerifiedAt: database.runtime.now(),
        version: 2,
      }).success,
    ).toBe(true)
  })
})

test("concurrent verified phone assignment keeps same-realm uniqueness and allows other realms", async () => {
  await withDatabasePair(async (first, second) => {
    const alpha = await createRealm(first, "users-phone-concurrent-alpha.example.com")
    const beta = await createRealm(first, "users-phone-concurrent-beta.example.com")
    const gamma = await createRealm(first, "users-phone-concurrent-gamma.example.com")
    const phoneNumber = "+14155552671"
    const firstAlphaUser = createUser(first, alpha.id, "concurrent-first", " +14155552671 ")
    const secondAlphaUser = createUser(first, alpha.id, "concurrent-second", "+14155552671")
    const betaUser = createUser(first, beta.id, "concurrent-other-realm", " +14155552671 ")
    expect(firstAlphaUser.success).toBe(true)
    expect(secondAlphaUser.success).toBe(true)
    expect(betaUser.success).toBe(true)
    if (!firstAlphaUser.success || !secondAlphaUser.success || !betaUser.success) return

    const alphaUsers = first.sqlite
      .query("SELECT id, phone_number, phone_number_verified_at FROM users WHERE realm_id = ? ORDER BY id")
      .all(alpha.id) as Array<{ id: string; phone_number: string; phone_number_verified_at: number | null }>
    expect(alphaUsers).toEqual([
      { id: firstAlphaUser.data.user.id, phone_number: "+14155552671", phone_number_verified_at: null },
      { id: secondAlphaUser.data.user.id, phone_number: "+14155552671", phone_number_verified_at: null },
    ])

    const firstRepository = userRepositoryCreate(first.db)
    const secondRepository = userRepositoryCreate(second.db)
    const verificationAttempts = await Promise.all([
      new Promise<ReturnType<typeof firstRepository.userUpdate>>((resolve) =>
        setTimeout(
          () =>
            resolve(
              firstRepository.userUpdate(alpha.id, firstAlphaUser.data.user.id, {
                phoneNumberVerifiedAt: 1_700_000_000_000,
                version: 2,
              }),
            ),
          0,
        ),
      ),
      new Promise<ReturnType<typeof secondRepository.userUpdate>>((resolve) =>
        setTimeout(
          () =>
            resolve(
              secondRepository.userUpdate(alpha.id, secondAlphaUser.data.user.id, {
                phoneNumberVerifiedAt: 1_700_000_000_001,
                version: 2,
              }),
            ),
          0,
        ),
      ),
    ])
    expect(verificationAttempts.filter((attempt) => attempt.success)).toHaveLength(1)
    expect(verificationAttempts.filter((attempt) => !attempt.success)).toHaveLength(1)
    expect(verificationAttempts.find((attempt) => !attempt.success)).toMatchObject({
      code: "users.write-failed",
      success: false,
    })

    const verifiedAlpha = firstRepository.userGetByVerifiedPhoneNumber(alpha.id, "+14155552671")
    expect(verifiedAlpha).toMatchObject({ success: true, data: { phoneNumber: "+14155552671" } })
    expect(
      first.sqlite
        .query("SELECT COUNT(*) AS count FROM users WHERE realm_id = ? AND phone_number_verified_at IS NOT NULL")
        .get(alpha.id),
    ).toEqual({ count: 1 })

    const crossRealmGammaUser = createUser(first, gamma.id, "concurrent-cross-realm-gamma", phoneNumber)
    expect(crossRealmGammaUser.success).toBe(true)
    if (!crossRealmGammaUser.success) return

    const crossRealmVerification = await Promise.all([
      new Promise<ReturnType<typeof firstRepository.userUpdate>>((resolve) =>
        setTimeout(
          () =>
            resolve(
              firstRepository.userUpdate(beta.id, betaUser.data.user.id, {
                phoneNumberVerifiedAt: 1_700_000_000_002,
                version: 2,
              }),
            ),
          0,
        ),
      ),
      new Promise<ReturnType<typeof secondRepository.userUpdate>>((resolve) =>
        setTimeout(
          () =>
            resolve(
              secondRepository.userUpdate(gamma.id, crossRealmGammaUser.data.user.id, {
                phoneNumberVerifiedAt: 1_700_000_000_003,
                version: 2,
              }),
            ),
          0,
        ),
      ),
    ])
    expect(crossRealmVerification.every((attempt) => attempt.success)).toBe(true)
    expect(firstRepository.userGetByVerifiedPhoneNumber(beta.id, "+14155552671")).toMatchObject({
      success: true,
      data: { id: betaUser.data.user.id },
    })
    expect(firstRepository.userGetByVerifiedPhoneNumber(gamma.id, "+14155552671")).toMatchObject({
      success: true,
      data: { id: crossRealmGammaUser.data.user.id },
    })
  })
})

test("user repository rejects invalid phone and registration verification transitions", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "users-phone-invariants.example.com")
    const created = createUser(database, realm.id, "invariant-user", "+14155552671")
    const withoutPhone = createUser(database, realm.id, "invariant-no-phone")
    expect(created.success).toBe(true)
    expect(withoutPhone.success).toBe(true)
    if (!created.success || !withoutPhone.success) return
    const repository = userRepositoryCreate(database.db)
    const now = database.runtime.now()

    const invalidCreated = repository.userCreate(
      {
        createdAt: now,
        email: "invalid-create@example.com",
        emailVerifiedAt: null,
        id: "invalid-create-user",
        phoneNumber: null,
        phoneNumberVerifiedAt: now,
        realmId: realm.id,
        registrationVerifiedAt: null,
        registrationVerificationMethod: null,
        state: "initial",
        updatedAt: now,
        userName: "invalid-create-user",
        version: 1,
      },
      {
        displayName: "Invalid create",
        firstName: null,
        gender: null,
        lastName: null,
        nickName: null,
        preferredLanguage: null,
        realmId: realm.id,
        updatedAt: now,
        userId: "invalid-create-user",
      },
    )
    expect(invalidCreated).toMatchObject({ code: "users.invalid-transition", success: false })
    expect(
      repository.userUpdate(realm.id, withoutPhone.data.user.id, {
        phoneNumberVerifiedAt: now,
        version: 2,
      }),
    ).toMatchObject({ code: "users.invalid-transition", success: false })
    expect(
      repository.userUpdate(realm.id, created.data.user.id, {
        phoneNumber: " +14155552672 ",
        phoneNumberVerifiedAt: now,
        version: 2,
      }),
    ).toMatchObject({ code: "users.invalid-transition", success: false })
    const verified = repository.userUpdate(realm.id, created.data.user.id, {
      phoneNumberVerifiedAt: now,
      version: 2,
    })
    expect(verified.success).toBe(true)
    expect(
      repository.userUpdate(realm.id, created.data.user.id, {
        phoneNumber: "+14155552672",
        version: 3,
      }),
    ).toMatchObject({ code: "users.invalid-transition", success: false })
    expect(
      repository.userUpdate(realm.id, created.data.user.id, {
        phoneNumber: null,
        version: 3,
      }),
    ).toMatchObject({ code: "users.invalid-transition", success: false })
    const changed = repository.userUpdate(realm.id, created.data.user.id, {
      phoneNumber: "+14155552672",
      phoneNumberVerifiedAt: null,
      version: 3,
    })
    expect(changed.success).toBe(true)

    expect(
      repository.userUpdate(realm.id, created.data.user.id, {
        registrationVerifiedAt: now,
        version: 4,
      }),
    ).toMatchObject({ code: "users.invalid-transition", success: false })
    expect(
      repository.userUpdate(realm.id, created.data.user.id, {
        registrationVerificationMethod: "email",
        version: 4,
      }),
    ).toMatchObject({ code: "users.invalid-transition", success: false })
    expect(
      repository.userUpdate(realm.id, created.data.user.id, {
        registrationVerifiedAt: now,
        registrationVerificationMethod: "email",
        version: 4,
      }),
    ).toMatchObject({ code: "users.invalid-transition", success: false })
    expect(
      repository.userUpdate(realm.id, created.data.user.id, {
        registrationVerifiedAt: now,
        registrationVerificationMethod: "whatsapp",
        version: 4,
      }),
    ).toMatchObject({ code: "users.invalid-transition", success: false })
  })
})

test("email verification preserves its event contract and emits registration verification separately", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "users-phone-email.example.com")
    const created = createUser(database, realm.id, "email-user")
    expect(created.success).toBe(true)
    if (!created.success) return

    const verified = userEmailVerificationSet({
      context: realmSystemContextCreate("system"),
      database,
      input: { state: "verified" },
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(verified.success).toBe(true)
    if (!verified.success) return
    expect(verified.data.user).toMatchObject({
      emailVerified: true,
      registrationVerificationMethod: "email",
      verificationState: "verified",
    })

    const events = database.sqlite
      .query(
        "SELECT aggregate_version, event_type, payload FROM events WHERE aggregate_id = ? ORDER BY aggregate_version",
      )
      .all(created.data.user.id) as Array<{ aggregate_version: number; event_type: string; payload: string }>
    expect(events.map((event) => event.event_type)).toEqual([
      userEventTypes.created,
      userEventTypes.emailVerificationChanged,
      userEventTypes.registrationVerificationChanged,
    ])
    expect(events.map((event) => event.aggregate_version)).toEqual([1, 2, 3])

    const emailPayload = v.safeParse(
      userEmailVerificationChangedEventPayloadSchema,
      JSON.parse(events[1]?.payload ?? "{}"),
    )
    expect(emailPayload.success).toBe(true)
    if (emailPayload.success) expect(emailPayload.output).toEqual({ state: "verified" })

    const registrationPayload = v.safeParse(
      userRegistrationVerificationChangedEventPayloadSchema,
      JSON.parse(events[2]?.payload ?? "{}"),
    )
    expect(registrationPayload.success).toBe(true)
    if (registrationPayload.success)
      expect(registrationPayload.output).toEqual({ registrationVerificationMethod: "email", state: "verified" })
  })
})

test("email verification preserves an established WhatsApp registration origin", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "users-phone-whatsapp-origin.example.com")
    const created = createUser(database, realm.id, "whatsapp-origin", "+14155552671")
    expect(created.success).toBe(true)
    if (!created.success) return

    const registrationVerifiedAt = database.runtime.now()
    const repository = userRepositoryCreate(database.db)
    const whatsappVerified = repository.userUpdate(realm.id, created.data.user.id, {
      phoneNumberVerifiedAt: registrationVerifiedAt,
      registrationVerifiedAt,
      registrationVerificationMethod: "whatsapp",
      version: 2,
    })
    expect(whatsappVerified.success).toBe(true)

    const emailVerified = userEmailVerificationSet({
      context: realmSystemContextCreate("system"),
      database,
      input: { state: "verified" },
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(emailVerified.success).toBe(true)
    if (!emailVerified.success) return
    expect(emailVerified.data.user).toMatchObject({
      emailVerified: true,
      registrationVerifiedAt,
      registrationVerificationMethod: "whatsapp",
      verificationState: "verified",
    })

    const events = database.sqlite
      .query("SELECT event_type FROM events WHERE aggregate_id = ? ORDER BY aggregate_version")
      .all(created.data.user.id) as Array<{ event_type: string }>
    expect(events.map((event) => event.event_type)).toEqual([
      userEventTypes.created,
      userEventTypes.emailVerificationChanged,
    ])
  })
})

test("email unverification revokes an email registration origin and emits consecutive facts", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "users-phone-email-revoke.example.com")
    const created = createUser(database, realm.id, "email-revoke")
    expect(created.success).toBe(true)
    if (!created.success) return

    expect(
      userEmailVerificationSet({
        context: realmSystemContextCreate("system"),
        database,
        input: { state: "verified" },
        realmId: realm.id,
        userId: created.data.user.id,
      }).success,
    ).toBe(true)
    const unverified = userEmailVerificationSet({
      context: realmSystemContextCreate("system"),
      database,
      input: { state: "unverified" },
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(unverified.success).toBe(true)
    if (!unverified.success) return
    expect(unverified.data.user).toMatchObject({ emailVerified: false, verificationState: "unverified" })
    expect(unverified.data.user).not.toHaveProperty("registrationVerifiedAt")
    expect(unverified.data.user).not.toHaveProperty("registrationVerificationMethod")

    const events = database.sqlite
      .query(
        "SELECT aggregate_version, event_type, payload FROM events WHERE aggregate_id = ? ORDER BY aggregate_version",
      )
      .all(created.data.user.id) as Array<{ aggregate_version: number; event_type: string; payload: string }>
    expect(events.map((event) => event.aggregate_version)).toEqual([1, 2, 3, 4, 5])
    expect(events.map((event) => event.event_type)).toEqual([
      userEventTypes.created,
      userEventTypes.emailVerificationChanged,
      userEventTypes.registrationVerificationChanged,
      userEventTypes.emailVerificationChanged,
      userEventTypes.registrationVerificationChanged,
    ])

    const emailPayload = v.safeParse(
      userEmailVerificationChangedEventPayloadSchema,
      JSON.parse(events[3]?.payload ?? "{}"),
    )
    expect(emailPayload.success).toBe(true)
    if (emailPayload.success) expect(emailPayload.output).toEqual({ state: "unverified" })

    const registrationPayload = v.safeParse(
      userRegistrationVerificationChangedEventPayloadSchema,
      JSON.parse(events[4]?.payload ?? "{}"),
    )
    expect(registrationPayload.success).toBe(true)
    if (registrationPayload.success)
      expect(registrationPayload.output).toEqual({ registrationVerificationMethod: null, state: "unverified" })

    const eventCount = events.length
    expect(
      userEmailVerificationSet({
        context: realmSystemContextCreate("system"),
        database,
        input: { state: "unverified" },
        realmId: realm.id,
        userId: created.data.user.id,
      }),
    ).toMatchObject({ code: "users.conflict", success: false })
    expect(
      database.sqlite.query("SELECT COUNT(*) AS count FROM events WHERE aggregate_id = ?").get(created.data.user.id),
    ).toEqual({ count: eventCount })
  })
})

test("email unverification preserves a WhatsApp registration origin without a registration event", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "users-phone-whatsapp-revoke.example.com")
    const created = createUser(database, realm.id, "whatsapp-revoke", "+14155552672")
    expect(created.success).toBe(true)
    if (!created.success) return

    const registrationVerifiedAt = database.runtime.now()
    const repository = userRepositoryCreate(database.db)
    const whatsappVerified = repository.userUpdate(realm.id, created.data.user.id, {
      phoneNumberVerifiedAt: registrationVerifiedAt,
      registrationVerifiedAt,
      registrationVerificationMethod: "whatsapp",
      version: 2,
    })
    expect(whatsappVerified.success).toBe(true)

    const emailVerified = userEmailVerificationSet({
      context: realmSystemContextCreate("system"),
      database,
      input: { state: "verified" },
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(emailVerified.success).toBe(true)
    if (!emailVerified.success) return

    const emailUnverified = userEmailVerificationSet({
      context: realmSystemContextCreate("system"),
      database,
      input: { state: "unverified" },
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(emailUnverified.success).toBe(true)
    if (!emailUnverified.success) return
    expect(emailUnverified.data.user).toMatchObject({
      emailVerified: false,
      registrationVerifiedAt,
      registrationVerificationMethod: "whatsapp",
      verificationState: "verified",
    })

    const events = database.sqlite
      .query("SELECT aggregate_version, event_type FROM events WHERE aggregate_id = ? ORDER BY aggregate_version")
      .all(created.data.user.id) as Array<{ aggregate_version: number; event_type: string }>
    expect(events.map((event) => event.aggregate_version)).toEqual([1, 3, 4])
    expect(events.map((event) => event.event_type)).toEqual([
      userEventTypes.created,
      userEventTypes.emailVerificationChanged,
      userEventTypes.emailVerificationChanged,
    ])

    const eventCount = events.length
    expect(
      userEmailVerificationSet({
        context: realmSystemContextCreate("system"),
        database,
        input: { state: "unverified" },
        realmId: realm.id,
        userId: created.data.user.id,
      }),
    ).toMatchObject({ code: "users.conflict", success: false })
    expect(
      database.sqlite.query("SELECT COUNT(*) AS count FROM events WHERE aggregate_id = ?").get(created.data.user.id),
    ).toEqual({ count: eventCount })
  })
})

test("user schema creation and reset retain the phone columns and verified index", async () => {
  await withDatabase(async (database) => {
    const indexes = database.sqlite.query("PRAGMA index_list(users)").all() as Array<{ name: string }>
    expect(indexes.some((index) => index.name === "users_realm_verified_phone_idx")).toBe(true)

    expect(storageDatabaseReset(database)).toEqual({ data: undefined, success: true })
    const columns = database.sqlite.query("PRAGMA table_info(users)").all() as Array<{ name: string }>
    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "phone_number",
        "phone_number_verified_at",
        "registration_verified_at",
        "registration_verification_method",
      ]),
    )
  })
})

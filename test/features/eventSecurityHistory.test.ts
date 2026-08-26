import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eventUserSecurityHistoryList } from "../../src/features/events/actions/eventUserSecurityHistoryList.js"
import { eventSecurityHistoryCursorDecode } from "../../src/features/events/domain/eventSecurityHistoryCursorDecode.js"
import { eventSecurityEventDefinitionByType } from "../../src/features/events/domain/eventSecurityEventDefinitionByType.js"
import { eventRepositoryCreate } from "../../src/features/events/persistence/eventRepositoryCreate.js"
import { eventUserSubjectTable } from "../../src/features/events/persistence/eventUserSubjectTable.js"
import { eventSecurityEventAppend } from "../../src/features/events/server/eventSecurityEventAppend.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../src/platform/storage/storageTransactionRun.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-security-history-"))
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

async function createRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({
    context: realmSystemContextCreate(),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

function createUser(database: StorageDatabase, realmId: string, userName: string) {
  const created = userCreate({
    context: realmSystemContextCreate(),
    database,
    input: {
      email: `${userName}@example.com`,
      profile: { displayName: userName, firstName: userName, lastName: "User" },
      userName,
    },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.user.id
}

function appendEvent(
  database: StorageDatabase,
  input: { actorId: string; aggregateId: string; realmId: string; userSubjectId: string; occurredAt: number },
) {
  const appended = storageTransactionRun(database, (transaction) =>
    eventSecurityEventAppend(
      transaction,
      {
        actorId: input.actorId,
        aggregateId: input.aggregateId,
        aggregateType: "test_security_event",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId: `correlation-${input.aggregateId}`,
        eventType: "session.created",
        metadata: { auditSafe: true, source: "test" },
        occurredAt: input.occurredAt,
        payload: { secret: "must-not-be-read" },
        realmId: input.realmId,
        userSubjectId: input.userSubjectId,
      },
      database.runtime,
    ),
  )
  expect(appended.success).toBe(true)
}

test("security history follows the explicit subject, not the actor, and isolates realms", async () => {
  await withDatabase(async (database) => {
    const alpha = await createRealm(database, "security-history-alpha.example.com")
    const beta = await createRealm(database, "security-history-beta.example.com")
    const alphaSubject = createUser(database, alpha.id, "alpha-subject")
    const alphaActor = createUser(database, alpha.id, "alpha-actor")
    const betaSubject = createUser(database, beta.id, "beta-subject")

    appendEvent(database, {
      actorId: alphaActor,
      aggregateId: "subject-event",
      occurredAt: 100,
      realmId: alpha.id,
      userSubjectId: alphaSubject,
    })
    appendEvent(database, {
      actorId: alphaSubject,
      aggregateId: "actor-event",
      occurredAt: 200,
      realmId: alpha.id,
      userSubjectId: alphaActor,
    })
    appendEvent(database, {
      actorId: alphaActor,
      aggregateId: "other-realm-event",
      occurredAt: 300,
      realmId: beta.id,
      userSubjectId: betaSubject,
    })
    const indexed = database.db.select().from(eventUserSubjectTable).all()
    expect(indexed).toHaveLength(3)

    const subjectHistory = eventUserSecurityHistoryList({ database, realmId: alpha.id, userId: alphaSubject })
    expect(subjectHistory.success).toBe(true)
    if (!subjectHistory.success) return
    expect(subjectHistory.data.items).toHaveLength(1)
    expect(subjectHistory.data.items[0]?.id).toBeString()
    expect(subjectHistory.data.items[0]?.subjectId).toBe(alphaSubject)
    expect(subjectHistory.data.items[0]?.actorId).toBe(alphaActor)

    const actorHistory = eventUserSecurityHistoryList({ database, realmId: alpha.id, userId: alphaActor })
    expect(actorHistory.success).toBe(true)
    if (!actorHistory.success) return
    expect(actorHistory.data.items).toHaveLength(1)
    expect(actorHistory.data.items[0]?.subjectId).toBe(alphaActor)

    const betaHistory = eventUserSecurityHistoryList({ database, realmId: beta.id, userId: betaSubject })
    expect(betaHistory.success).toBe(true)
    if (!betaHistory.success) return
    expect(betaHistory.data.items).toHaveLength(1)
    expect(betaHistory.data.items[0]?.subjectId).toBe(betaSubject)

    const crossRealm = eventUserSecurityHistoryList({ database, realmId: beta.id, userId: alphaSubject })
    expect(crossRealm.success).toBe(true)
    if (!crossRealm.success) return
    expect(crossRealm.data.items).toHaveLength(0)
  })
})

test("the task-7 event inventory has production integration and an explicit subject mapping for every type", () => {
  const inventoriedEventTypesByFamily = {
    sessions: ["session.created", "session.revoked", "session.revoked_all", "session.rotated"],
    passwords: [
      "password.credential_changed",
      "password.email_verified",
      "password.login_failed",
      "password.login_succeeded",
      "password.locked",
      "password.recovered",
      "password.recovery_requested",
      "password.unlocked",
      "password.whatsapp_verified",
    ],
    mfa: [
      "mfa.challenge.completed",
      "mfa.challenge.failed",
      "mfa.challenge.started",
      "mfa.recovery_code.used",
      "mfa.recovery_codes.generated",
      "mfa.totp.enrollment.confirmed",
      "mfa.totp.enrollment.started",
      "mfa.totp.removed",
      "mfa.totp.verified",
    ],
    passkeys: [
      "passkey.authentication_completed",
      "passkey.authentication_started",
      "passkey.credential_revoked",
      "passkey.credential_used",
      "passkey.registration_completed",
      "passkey.registration_started",
    ],
    linkedIdentities: ["external_identity.linked", "external_identity.unlinked"],
    emailChanges: [
      "user.email_change_failed",
      "user.email_change_requested",
      "user.email_change_verified",
      "user.email_changed",
    ],
    refreshTokenRevocations: ["oidc.access_token_revoked", "oidc.refresh_token_family_revoked"],
    impersonationNotices: ["impersonation.started", "impersonation.ended"],
  } as const
  const inventoriedEventTypes = Object.values(inventoriedEventTypesByFamily).flat()
  expect(Object.keys(eventSecurityEventDefinitionByType).sort()).toEqual([...inventoriedEventTypes].sort())
  for (const eventType of inventoriedEventTypes) {
    const definition = eventSecurityEventDefinitionByType[eventType]
    expect(definition.productionIntegrations.length).toBeGreaterThan(0)
    expect(definition.productionIntegrations.every((integration) => integration.length > 0)).toBe(true)
    expect(definition.subject).toBeString()
  }
  expect(eventSecurityEventDefinitionByType["impersonation.started"].subject).toBe("impersonated_user")
  expect(eventSecurityEventDefinitionByType["impersonation.ended"].subject).toBe("impersonated_user")
})

test("the user-security append rejects malformed and null subjects", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "security-history-subjects.example.com")
    const subjects = [undefined, null, "", "   "] as const
    for (const userSubjectId of subjects) {
      const appended = storageTransactionRun(database, (transaction) =>
        eventSecurityEventAppend(
          transaction,
          {
            actorId: "actor",
            aggregateId: `invalid-subject-${String(userSubjectId)}`,
            aggregateType: "test_security_event",
            aggregateVersion: 1,
            commandIndex: 0,
            correlationId: "invalid-subject-correlation",
            eventType: "session.created",
            metadata: {},
            occurredAt: 1,
            payload: {},
            realmId: realm.id,
            userSubjectId: userSubjectId as unknown as string,
          },
          database.runtime,
        ),
      )
      expect(appended).toMatchObject({ code: "events.invalid", success: false })
    }
    const events = eventRepositoryCreate(database.db).eventList(realm.id)
    expect(events.success).toBe(true)
    if (!events.success) return
    expect(events.data.filter((event) => event.eventType === "session.created")).toHaveLength(0)
  })
})

test("security history rejects malformed cursor positions at its boundaries", () => {
  const valid = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8").toString("base64url")
  const malformed = [
    "",
    "not-a-cursor",
    valid({ position: 0, version: 1 }),
    valid({ position: -1, version: 1 }),
    valid({ position: 1.5, version: 1 }),
    valid({ position: 1, version: 2 }),
    valid({ position: 1, version: 1, extra: true }),
  ]
  for (const token of malformed) expect(eventSecurityHistoryCursorDecode(token).success).toBe(false)
  expect(eventSecurityHistoryCursorDecode(valid({ position: 1, version: 1 }))).toEqual({ data: 1, success: true })
  expect(eventSecurityHistoryCursorDecode(valid({ position: Number.MAX_SAFE_INTEGER, version: 1 }))).toEqual({
    data: Number.MAX_SAFE_INTEGER,
    success: true,
  })
})

test("password email verification maps its state and covered event in one transaction", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "security-history-email-verified.example.com")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    let token = ""
    let userId = ""
    const registered = passwordRegister({
      context,
      database,
      input: {
        email: "verified@example.com",
        password: "Correct Horse 12",
        profile: { displayName: "Verified User" },
        userName: "verified-user",
      },
      onVerificationToken: (delivery) => {
        token = delivery.token
        userId = delivery.userId
      },
      realmId: realm.id,
    })
    expect(registered.success).toBe(true)
    const verified = passwordEmailVerify({ context, database, input: { token }, realmId: realm.id })
    expect(verified.success).toBe(true)
    const history = eventUserSecurityHistoryList({ database, realmId: realm.id, userId })
    expect(history.success).toBe(true)
    if (!history.success) return
    expect(history.data.items.some((item) => item.eventType === "password.email_verified")).toBe(true)
    const indexed = database.db
      .select()
      .from(eventUserSubjectTable)
      .all()
      .find((item) => item.eventType === "password.email_verified")
    expect(indexed).toMatchObject({ realmId: realm.id, userId, eventType: "password.email_verified" })
  })
})

test("security history uses strict newest-position cursors and rolls back an unindexable event", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "security-history-cursor.example.com")
    const subject = createUser(database, realm.id, "cursor-subject")
    appendEvent(database, {
      actorId: subject,
      aggregateId: "first-event",
      occurredAt: 100,
      realmId: realm.id,
      userSubjectId: subject,
    })
    appendEvent(database, {
      actorId: subject,
      aggregateId: "second-event",
      occurredAt: 100,
      realmId: realm.id,
      userSubjectId: subject,
    })
    appendEvent(database, {
      actorId: subject,
      aggregateId: "third-event",
      occurredAt: 100,
      realmId: realm.id,
      userSubjectId: subject,
    })
    const storedEvents = eventRepositoryCreate(database.db).eventList(realm.id)
    expect(storedEvents.success).toBe(true)
    if (!storedEvents.success) return
    const eventIdGet = (aggregateId: string) => {
      const eventId = storedEvents.data.find((event) => event.aggregateId === aggregateId)?.id
      expect(eventId).toBeString()
      if (eventId === undefined) throw new Error("The test event was not stored.")
      return eventId
    }

    const firstPage = eventUserSecurityHistoryList({
      database,
      query: { pageSize: 2 },
      realmId: realm.id,
      userId: subject,
    })
    expect(firstPage.success).toBe(true)
    if (!firstPage.success) return
    expect(firstPage.data.items).toHaveLength(2)
    expect(firstPage.data.items.map((item) => item.id)).toEqual([eventIdGet("third-event"), eventIdGet("second-event")])
    expect(firstPage.data.nextPageToken).toBeString()

    appendEvent(database, {
      actorId: subject,
      aggregateId: "inserted-after-first-page",
      occurredAt: 350,
      realmId: realm.id,
      userSubjectId: subject,
    })

    const secondPage = eventUserSecurityHistoryList({
      database,
      query: { pageSize: 2, pageToken: firstPage.data.nextPageToken },
      realmId: realm.id,
      userId: subject,
    })
    expect(secondPage.success).toBe(true)
    if (!secondPage.success) return
    expect(secondPage.data.items).toHaveLength(1)
    expect(secondPage.data.items[0]?.id).toBe(eventIdGet("first-event"))
    expect(new Set(firstPage.data.items.map((item) => item.id))).not.toContain(secondPage.data.items[0]?.id)

    const ascending = eventUserSecurityHistoryList({
      database,
      query: { sortDirection: "asc" },
      realmId: realm.id,
      userId: subject,
    })
    expect(ascending).toEqual({
      code: "events.invalid",
      errorMessage: "Security history is ordered by newest event position.",
      op: "eventUserSecurityHistoryList",
      success: false,
    })

    const failed = storageTransactionRun(database, (transaction) =>
      eventSecurityEventAppend(
        transaction,
        {
          actorId: subject,
          aggregateId: "rolled-back-event",
          aggregateType: "test_security_event",
          aggregateVersion: 1,
          commandIndex: 0,
          correlationId: "correlation-rolled-back-event",
          eventType: "session.created",
          metadata: { auditSafe: true, source: "test" },
          occurredAt: 400,
          payload: {},
          realmId: realm.id,
          userSubjectId: "missing-user",
        },
        database.runtime,
      ),
    )
    expect(failed.success).toBe(false)
    const unknown = storageTransactionRun(database, (transaction) =>
      eventSecurityEventAppend(
        transaction,
        {
          actorId: subject,
          aggregateId: "unknown-event",
          aggregateType: "test_security_event",
          aggregateVersion: 1,
          commandIndex: 0,
          correlationId: "correlation-unknown-event",
          eventType: "security.unknown",
          metadata: {},
          occurredAt: 500,
          payload: {},
          realmId: realm.id,
          userSubjectId: subject,
        },
        database.runtime,
      ),
    )
    expect(unknown).toEqual({
      code: "events.invalid",
      errorMessage: "The event is not covered by the security-event allowlist.",
      op: "eventSecurityEventAppend",
      success: false,
    })
    const events = eventRepositoryCreate(database.db).eventList(realm.id)
    expect(events.success).toBe(true)
    if (!events.success) return
    expect(events.data.some((event) => event.aggregateId === "rolled-back-event")).toBe(false)
  })
})

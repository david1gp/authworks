import * as v from "valibot"
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../../compositions/serverApplicationCreate.js"
import { eventRealmTypeCount } from "../../events/server/eventRealmTypeCount.js"
import { realmAdministratorGrant } from "../../realms/actions/realmAdministratorGrant.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { sessionIssue } from "../../sessions/actions/sessionIssue.js"
import { userCreate } from "../../users/actions/userCreate.js"
import { userLifecycleSet } from "../../users/actions/userLifecycleSet.js"
import { wahaHealthCandidateRepositoryCreate } from "../../waha/persistence/wahaHealthCandidateRepositoryCreate.js"
import { wahaSendAttemptRepositoryCreate } from "../../waha/persistence/wahaSendAttemptRepositoryCreate.js"
import type { WahaConfiguration } from "../../waha/server/wahaConfiguration.js"
import { wahaHealthCandidateReaderCreate } from "../../waha/server/wahaHealthCandidateReaderCreate.js"
import { wahaRecipientHashCreate } from "../../waha/server/wahaRecipientHashCreate.js"
import { wahaUsageReaderCreate } from "../../waha/server/wahaUsageReaderCreate.js"
import { whatsappOtpApiClientCreate } from "../../whatsappOtp/client/whatsappOtpApiClientCreate.js"
import type { WhatsappOtpUsagePort } from "../../whatsappOtp/domain/whatsappOtpUsagePort.js"
import { whatsappOtpEventTypes } from "../../whatsappOtp/events/whatsappOtpEventTypes.js"
import { whatsappOtpAvailabilityCreate } from "../../whatsappOtp/server/whatsappOtpAvailabilityCreate.js"
import { whatsappOtpServerAppCreate } from "../../whatsappOtp/server/whatsappOtpServerAppCreate.js"
import type { WhatsappOtpUsageResponse } from "../../whatsappOtp/public/whatsappOtpUsageResponseSchema.js"
import { whatsappOtpUsageResponseSchema } from "../../whatsappOtp/public/whatsappOtpUsageResponseSchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"

const usageConfiguration: WahaConfiguration = {
  endpoints: [
    { client: { baseUrl: "https://primary.example.test" }, id: "primary" },
    { client: { baseUrl: "https://secondary.example.test" }, id: "secondary" },
  ],
  freshnessTtlMs: 60_000,
  refreshIntervalMs: 30_000,
  codeRedactionDisabled: false,
  senderDailyLimit: 3,
  senderHourlyLimit: 2,
}

async function withUsageDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-whatsapp-usage-"))
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

async function createUsageRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

async function createUsageSession(database: StorageDatabase, realmId: string, userName: string, admin: boolean) {
  const created = userCreate({
    context: realmSystemContextCreate(),
    database,
    input: {
      email: `${userName}@example.com`,
      profile: { displayName: userName },
      userName,
    },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const activated = userLifecycleSet({
    context: realmSystemContextCreate(),
    database,
    input: { state: "active" },
    realmId,
    userId: created.data.user.id,
  })
  expect(activated.success).toBe(true)
  if (admin) {
    const granted = realmAdministratorGrant({
      context: realmSystemContextCreate(),
      database,
      realmId,
      userId: created.data.user.id,
    })
    expect(granted.success).toBe(true)
  }
  const issued = sessionIssue({
    assurance: "authenticated",
    authenticationMethod: "password",
    database,
    realmId,
    userId: created.data.user.id,
  })
  expect(issued.success).toBe(true)
  if (!issued.success) throw new Error(issued.errorMessage)
  return issued.data.token
}

function usageReaderCreate(
  database: StorageDatabase,
  testkit: ReturnType<typeof platformTestkitCreate>,
  configuration: WahaConfiguration = usageConfiguration,
) {
  const repository = wahaHealthCandidateRepositoryCreate(database.db)
  const sendAttempts = wahaSendAttemptRepositoryCreate(database.db)
  return {
    repository,
    sendAttempts,
    usage: wahaUsageReaderCreate({
      configuration,
      repository,
      requestedCountGet: (realmId, since) =>
        eventRealmTypeCount(database, realmId, whatsappOtpEventTypes.requested, since),
      runtime: testkit.runtime,
      sendAttempts,
    }),
  }
}

function usageAppCreate(
  database: StorageDatabase,
  testkit: ReturnType<typeof platformTestkitCreate>,
  usage?: WhatsappOtpUsagePort,
) {
  const reader = wahaHealthCandidateReaderCreate({
    repository: wahaHealthCandidateRepositoryCreate(database.db),
  })
  const availability = whatsappOtpAvailabilityCreate({
    configuration: usageConfiguration,
    database,
    reader,
    runtime: testkit.runtime,
  })
  return whatsappOtpServerAppCreate({
    availability,
    database,
    ...(usage === undefined ? {} : { usage }),
  })
}

function candidateSeed(
  repository: ReturnType<typeof wahaHealthCandidateRepositoryCreate>,
  input: { checkedAt: number; endpointId: string; expiresAt: number; sessionName: string },
) {
  const created = repository.wahaHealthCandidateCreate({
    checkedAt: input.checkedAt,
    createdAt: input.checkedAt,
    endpointId: input.endpointId,
    expiresAt: input.expiresAt,
    failureAt: null,
    failureCode: null,
    failureMessage: null,
    sessionName: input.sessionName,
    status: "healthy",
    updatedAt: input.checkedAt,
    version: 1,
  })
  expect(created.success).toBe(true)
}

function attemptSeed(
  sendAttempts: ReturnType<typeof wahaSendAttemptRepositoryCreate>,
  input: {
    code?: string | null
    createdAt: number
    endpointId: string
    id: string
    phoneNumber: string
    purpose: string
    realmId: string | null
    recipientPhone?: string | null
    sessionName: string | null
    status: "sent" | "failed" | "blocked"
  },
): string {
  const hash = wahaRecipientHashCreate("usage-test-secret", input.phoneNumber)
  const recorded = sendAttempts.wahaSendAttemptRecord({
    createdAt: input.createdAt,
    endpointId: input.endpointId,
    id: input.id,
    purpose: input.purpose,
    realmId: input.realmId,
    recipientPhoneHash: hash,
    sessionName: input.sessionName,
    status: input.status,
    ...(input.code === undefined ? {} : { code: input.code }),
    ...(input.recipientPhone === undefined ? {} : { recipientPhone: input.recipientPhone }),
  })
  expect(recorded.success).toBe(true)
  return hash
}

function requestedSeed(
  database: StorageDatabase,
  testkit: ReturnType<typeof platformTestkitCreate>,
  input: { id: string; occurredAt: number; realmId: string },
) {
  const appended = storageEventAppend(
    database.db,
    {
      aggregateId: `usage-challenge-${input.id}`,
      aggregateType: "test",
      aggregateVersion: 1,
      commandIndex: 0,
      correlationId: `usage-correlation-${input.id}`,
      eventType: whatsappOtpEventTypes.requested,
      realmId: input.realmId,
      metadata: {},
      occurredAt: input.occurredAt,
      payload: {},
    },
    testkit.runtime,
  )
  expect(appended.success).toBe(true)
}

async function seedUsageScenario(
  database: StorageDatabase,
  testkit: ReturnType<typeof platformTestkitCreate>,
  realmId: string,
  otherRealmId: string,
) {
  const { repository, sendAttempts, usage } = usageReaderCreate(database, testkit)
  const now = testkit.runtime.now()
  const hourMs = 3_600_000
  candidateSeed(repository, { checkedAt: now, endpointId: "primary", expiresAt: now + 60_000, sessionName: "default" })
  candidateSeed(repository, { checkedAt: now, endpointId: "secondary", expiresAt: now + 60_000, sessionName: "other" })
  candidateSeed(repository, { checkedAt: now, endpointId: "primary", expiresAt: now - 1, sessionName: "stale" })
  candidateSeed(repository, {
    checkedAt: now,
    endpointId: "unconfigured",
    expiresAt: now + 60_000,
    sessionName: "default",
  })

  const phones = [
    "+15550001001",
    "+15550001002",
    "+15550001003",
    "+15550001004",
    "+15550001005",
    "+15550001006",
  ] as const
  const hashes: [string, string, string, string, string, string] = [
    attemptSeed(sendAttempts, {
      createdAt: now - 30 * 60_000,
      endpointId: "primary",
      id: "usage-attempt-1",
      phoneNumber: phones[0],
      purpose: "sign_in",
      realmId,
      sessionName: "default",
      status: "sent",
    }),
    attemptSeed(sendAttempts, {
      createdAt: now - 20 * 60_000,
      endpointId: "primary",
      id: "usage-attempt-2",
      phoneNumber: phones[1],
      purpose: "sign_in",
      realmId,
      sessionName: "default",
      status: "sent",
    }),
    attemptSeed(sendAttempts, {
      createdAt: now - 10 * 60_000,
      endpointId: "primary",
      id: "usage-attempt-3",
      phoneNumber: phones[2],
      purpose: "registration",
      realmId,
      sessionName: "default",
      status: "failed",
    }),
    attemptSeed(sendAttempts, {
      createdAt: now - 2 * hourMs,
      endpointId: "primary",
      id: "usage-attempt-4",
      phoneNumber: phones[3],
      purpose: "sign_in",
      realmId,
      sessionName: "default",
      status: "sent",
    }),
    attemptSeed(sendAttempts, {
      createdAt: now - 3 * hourMs,
      endpointId: "primary",
      id: "usage-attempt-5",
      phoneNumber: phones[4],
      purpose: "unknown",
      realmId,
      sessionName: null,
      status: "blocked",
    }),
    attemptSeed(sendAttempts, {
      createdAt: now - 25 * hourMs,
      endpointId: "primary",
      id: "usage-attempt-6",
      phoneNumber: phones[5],
      purpose: "sign_in",
      realmId,
      sessionName: "default",
      status: "sent",
    }),
  ]
  requestedSeed(database, testkit, { id: "hour", occurredAt: now - 30 * 60_000, realmId })
  requestedSeed(database, testkit, { id: "day", occurredAt: now - 2 * hourMs, realmId })
  requestedSeed(database, testkit, { id: "old", occurredAt: now - 25 * hourMs, realmId })
  requestedSeed(database, testkit, { id: "other", occurredAt: now - 30 * 60_000, realmId: otherRealmId })
  return { hashes, now, phones: [...phones], usage }
}

test("WhatsApp usage reports per-sender quota, totals, realm requests, and status counts", async () => {
  await withUsageDatabase(async (database, testkit) => {
    const realm = await createUsageRealm(database, "whatsapp-usage.example.com")
    const otherRealm = await createUsageRealm(database, "whatsapp-usage-other.example.com")
    const adminToken = await createUsageSession(database, realm.id, "usage-admin", true)
    const { hashes, usage } = await seedUsageScenario(database, testkit, realm.id, otherRealm.id)
    const app = usageAppCreate(database, testkit, usage)

    const response = await app.request(`https://whatsapp-usage.example.com/realms/${realm.id}/whatsapp-otp/usage`, {
      headers: { cookie: `session=${adminToken}` },
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as WhatsappOtpUsageResponse
    expect(v.safeParse(whatsappOtpUsageResponseSchema, body).success).toBe(true)
    expect(body.limits).toEqual({ dailyPerSender: 3, hourlyPerSender: 2 })
    expect(body.senders).toEqual([
      {
        endpointId: "primary",
        healthy: true,
        remainingDay: 0,
        remainingHour: 0,
        sentLastDay: 3,
        sentLastHour: 2,
        sessionName: "default",
      },
      {
        endpointId: "primary",
        healthy: false,
        remainingDay: 3,
        remainingHour: 2,
        sentLastDay: 0,
        sentLastHour: 0,
        sessionName: "stale",
      },
      {
        endpointId: "secondary",
        healthy: true,
        remainingDay: 3,
        remainingHour: 2,
        sentLastDay: 0,
        sentLastHour: 0,
        sessionName: "other",
      },
    ])
    expect(body.totals).toEqual({ sentLastDay: 3, sentLastHour: 2 })
    expect(body.requests).toEqual({ otpRequestedLastDay: 2, otpRequestedLastHour: 1 })
    expect(body.attempts.byStatusLastHour).toEqual({ blocked: 0, failed: 1, sent: 2 })
    expect(body.attempts.byStatusLastDay).toEqual({ blocked: 1, failed: 1, sent: 3 })
    expect(body.attempts.byPurposeLastDay).toEqual({ registration: 1, sign_in: 3, unknown: 1 })
    // The default 24h recent window excludes the 25h-old sixth seed row.
    expect(body.recent).toHaveLength(5)
    expect(body.recent.map((row) => row.createdAt)).toEqual(
      [...body.recent.map((row) => row.createdAt)].sort((a, b) => b - a),
    )
    expect(body.recent[0]).toMatchObject({ endpointId: "primary", purpose: "registration", status: "failed" })
    expect(body.recent.map((row) => row.recipientHashPrefix)).toEqual(
      [hashes[2], hashes[1], hashes[0], hashes[3], hashes[4]].map((hash) => hash.slice(0, 8)),
    )

    const client = whatsappOtpApiClientCreate({
      baseUrl: "https://whatsapp-usage.example.com",
      fetch: async (input, init) =>
        app.request(input.toString(), { ...init, headers: { cookie: `session=${adminToken}` } }),
    })
    const clientResult = await client.whatsappOtpUsageGet(realm.id)
    expect(clientResult.success).toBe(true)
    if (!clientResult.success) return
    expect(v.safeParse(whatsappOtpUsageResponseSchema, clientResult.data).success).toBe(true)
    expect(clientResult.data.totals).toEqual({ sentLastDay: 3, sentLastHour: 2 })
  })
})

test("WhatsApp usage request counts stay scoped to the requested realm", async () => {
  await withUsageDatabase(async (database, testkit) => {
    const realm = await createUsageRealm(database, "whatsapp-usage-realm.example.com")
    const otherRealm = await createUsageRealm(database, "whatsapp-usage-realm-other.example.com")
    const otherAdminToken = await createUsageSession(database, otherRealm.id, "usage-other-admin", true)
    const { usage } = await seedUsageScenario(database, testkit, realm.id, otherRealm.id)
    const app = usageAppCreate(database, testkit, usage)

    const response = await app.request(
      `https://whatsapp-usage-realm-other.example.com/realms/${otherRealm.id}/whatsapp-otp/usage`,
      { headers: { cookie: `session=${otherAdminToken}` } },
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as WhatsappOtpUsageResponse
    expect(v.safeParse(whatsappOtpUsageResponseSchema, body).success).toBe(true)
    expect(body.requests).toEqual({ otpRequestedLastDay: 1, otpRequestedLastHour: 1 })
    expect(body.totals).toEqual({ sentLastDay: 3, sentLastHour: 2 })
  })
})

test("WhatsApp usage rejects anonymous, non-admin, cross-realm, and invalid-limit requests", async () => {
  await withUsageDatabase(async (database, testkit) => {
    const realm = await createUsageRealm(database, "whatsapp-usage-auth.example.com")
    const otherRealm = await createUsageRealm(database, "whatsapp-usage-auth-other.example.com")
    const adminToken = await createUsageSession(database, realm.id, "usage-auth-admin", true)
    const memberToken = await createUsageSession(database, realm.id, "usage-auth-member", false)
    const otherAdminToken = await createUsageSession(database, otherRealm.id, "usage-auth-other-admin", true)
    const { usage } = usageReaderCreate(database, testkit)
    const app = usageAppCreate(database, testkit, usage)
    const url = `https://whatsapp-usage-auth.example.com/realms/${realm.id}/whatsapp-otp/usage`

    const anonymous = await app.request(url)
    expect(anonymous.status).toBe(401)

    const denied = await app.request(url, { headers: { cookie: `session=${memberToken}` } })
    expect(denied.status).toBe(403)
    expect(((await denied.json()) as { error: { code: string } }).error.code).toBe("authorization.forbidden")

    const crossRealm = await app.request(url, { headers: { cookie: `session=${otherAdminToken}` } })
    expect(crossRealm.status).toBe(401)

    for (const invalid of ["?limit=abc", "?limit=0", "?limit=201", "?window=30d", "?window=hour", "?window="]) {
      const rejected = await app.request(`${url}${invalid}`, { headers: { cookie: `session=${adminToken}` } })
      expect(rejected.status).toBe(400)
      expect(((await rejected.json()) as { error: { code: string } }).error.code).toBe("whatsapp-otp.invalid")
    }

    const allowed = await app.request(url, { headers: { cookie: `session=${adminToken}` } })
    expect(allowed.status).toBe(200)
    const body = (await allowed.json()) as WhatsappOtpUsageResponse
    expect(v.safeParse(whatsappOtpUsageResponseSchema, body).success).toBe(true)
    expect(body.senders).toEqual([])
  })
})

test("WhatsApp usage recent list is capped and never exposes full hashes or phone numbers", async () => {
  await withUsageDatabase(async (database, testkit) => {
    const realm = await createUsageRealm(database, "whatsapp-usage-recent.example.com")
    const otherRealm = await createUsageRealm(database, "whatsapp-usage-recent-other.example.com")
    const adminToken = await createUsageSession(database, realm.id, "usage-recent-admin", true)
    const { hashes, phones, usage } = await seedUsageScenario(database, testkit, realm.id, otherRealm.id)
    const app = usageAppCreate(database, testkit, usage)

    const response = await app.request(
      `https://whatsapp-usage-recent.example.com/realms/${realm.id}/whatsapp-otp/usage?limit=2`,
      { headers: { cookie: `session=${adminToken}` } },
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as WhatsappOtpUsageResponse
    expect(v.safeParse(whatsappOtpUsageResponseSchema, body).success).toBe(true)
    expect(body.recent).toHaveLength(2)
    expect(body.recent[0]?.createdAt).toBeGreaterThan(body.recent[1]?.createdAt ?? 0)
    expect(body.recent[0]?.recipientHashPrefix).toBe(hashes[2].slice(0, 8))
    expect(body.recent[1]?.recipientHashPrefix).toBe(hashes[1].slice(0, 8))

    const serialized = JSON.stringify(body)
    for (const phone of phones) expect(serialized.includes(phone)).toBe(false)
    for (const hash of hashes) expect(serialized.includes(hash)).toBe(false)
  })
})

test("WhatsApp usage defaults to empty usage when the route has no port", async () => {
  await withUsageDatabase(async (database, testkit) => {
    const realm = await createUsageRealm(database, "whatsapp-usage-default.example.com")
    const adminToken = await createUsageSession(database, realm.id, "usage-default-admin", true)
    const app = usageAppCreate(database, testkit)

    const response = await app.request(
      `https://whatsapp-usage-default.example.com/realms/${realm.id}/whatsapp-otp/usage`,
      { headers: { cookie: `session=${adminToken}` } },
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as WhatsappOtpUsageResponse
    expect(v.safeParse(whatsappOtpUsageResponseSchema, body).success).toBe(true)
    expect(body).toEqual({
      attempts: {
        byPurposeLastDay: {},
        byStatusLastDay: { blocked: 0, failed: 0, sent: 0 },
        byStatusLastHour: { blocked: 0, failed: 0, sent: 0 },
      },
      limits: { dailyPerSender: 100, hourlyPerSender: 20 },
      recent: [],
      requests: { otpRequestedLastDay: 0, otpRequestedLastHour: 0 },
      senders: [],
      totals: { sentLastDay: 0, sentLastHour: 0 },
    })
  })
})

test("Server composition returns empty WhatsApp usage when WAHA is not configured", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-whatsapp-usage-composition-"))
  const path = join(directory, "authworks.sqlite")
  const seeded = storageDatabaseOpen(path)
  expect(seeded.success).toBe(true)
  if (!seeded.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const realm = await createUsageRealm(seeded.data, "whatsapp-usage-composition.example.com")
  const adminToken = await createUsageSession(seeded.data, realm.id, "usage-composition-admin", true)
  seeded.data.close()

  const created = serverApplicationCreate({ databasePath: path })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  try {
    const response = await created.data.request(
      `https://whatsapp-usage-composition.example.com/realms/${realm.id}/whatsapp-otp/usage`,
      { headers: { cookie: `session=${adminToken}` } },
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as WhatsappOtpUsageResponse
    expect(v.safeParse(whatsappOtpUsageResponseSchema, body).success).toBe(true)
    expect(body.senders).toEqual([])
    expect(body.recent).toEqual([])
    expect(body.limits).toEqual({ dailyPerSender: 100, hourlyPerSender: 20 })
    expect(body.totals).toEqual({ sentLastDay: 0, sentLastHour: 0 })
    expect(body.requests).toEqual({ otpRequestedLastDay: 0, otpRequestedLastHour: 0 })
  } finally {
    created.data.stop()
    await rm(directory, { force: true, recursive: true })
  }
})

test("WhatsApp usage recent redacts codes by default while exposing full phone numbers", async () => {
  await withUsageDatabase(async (database, testkit) => {
    const realm = await createUsageRealm(database, "whatsapp-usage-redact.example.com")
    const adminToken = await createUsageSession(database, realm.id, "usage-redact-admin", true)
    const { sendAttempts, usage } = usageReaderCreate(database, testkit)
    const now = testkit.runtime.now()
    attemptSeed(sendAttempts, {
      code: "123456",
      createdAt: now - 5 * 60_000,
      endpointId: "primary",
      id: "usage-redact-1",
      phoneNumber: "+15550009901",
      purpose: "sign_in",
      realmId: realm.id,
      recipientPhone: "+15550009901",
      sessionName: "default",
      status: "sent",
    })
    const app = usageAppCreate(database, testkit, usage)

    const response = await app.request(
      `https://whatsapp-usage-redact.example.com/realms/${realm.id}/whatsapp-otp/usage`,
      { headers: { cookie: `session=${adminToken}` } },
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as WhatsappOtpUsageResponse
    expect(v.safeParse(whatsappOtpUsageResponseSchema, body).success).toBe(true)
    expect(body.recent).toHaveLength(1)
    expect(body.recent[0]).toMatchObject({ code: "1***6", recipientPhone: "+15550009901" })

    const serialized = JSON.stringify(body)
    expect(serialized.includes("123456")).toBe(false)
    expect(serialized.includes("+15550009901")).toBe(true)
  })
})

test("WhatsApp usage recent exposes full codes when redaction is disabled", async () => {
  await withUsageDatabase(async (database, testkit) => {
    const realm = await createUsageRealm(database, "whatsapp-usage-unredacted.example.com")
    const adminToken = await createUsageSession(database, realm.id, "usage-unredacted-admin", true)
    const { sendAttempts, usage } = usageReaderCreate(database, testkit, {
      ...usageConfiguration,
      codeRedactionDisabled: true,
    })
    const now = testkit.runtime.now()
    attemptSeed(sendAttempts, {
      code: "123456",
      createdAt: now - 5 * 60_000,
      endpointId: "primary",
      id: "usage-unredacted-1",
      phoneNumber: "+15550009902",
      purpose: "sign_in",
      realmId: realm.id,
      recipientPhone: "+15550009902",
      sessionName: "default",
      status: "sent",
    })
    const app = usageAppCreate(database, testkit, usage)

    const response = await app.request(
      `https://whatsapp-usage-unredacted.example.com/realms/${realm.id}/whatsapp-otp/usage`,
      { headers: { cookie: `session=${adminToken}` } },
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as WhatsappOtpUsageResponse
    expect(v.safeParse(whatsappOtpUsageResponseSchema, body).success).toBe(true)
    expect(body.recent).toHaveLength(1)
    expect(body.recent[0]).toMatchObject({ code: "123456", recipientPhone: "+15550009902" })
  })
})

test("WhatsApp usage recent window filters older rows without touching tiles", async () => {
  await withUsageDatabase(async (database, testkit) => {
    const realm = await createUsageRealm(database, "whatsapp-usage-window.example.com")
    const adminToken = await createUsageSession(database, realm.id, "usage-window-admin", true)
    const { repository, sendAttempts, usage } = usageReaderCreate(database, testkit)
    const now = testkit.runtime.now()
    candidateSeed(repository, {
      checkedAt: now,
      endpointId: "primary",
      expiresAt: now + 60_000,
      sessionName: "default",
    })
    const hourMs = 3_600_000
    const seeds = [
      { ageMs: 10 * 60_000, code: "111111", id: "usage-window-fresh", phone: "+15550009101" },
      { ageMs: 25 * hourMs, code: "222222", id: "usage-window-25h", phone: "+15550009102" },
      { ageMs: 4 * 24 * hourMs, code: "333333", id: "usage-window-4d", phone: "+15550009103" },
      { ageMs: 8 * 24 * hourMs, code: "444444", id: "usage-window-8d", phone: "+15550009104" },
    ] as const
    for (const seed of seeds) {
      attemptSeed(sendAttempts, {
        code: seed.code,
        createdAt: now - seed.ageMs,
        endpointId: "primary",
        id: seed.id,
        phoneNumber: seed.phone,
        purpose: "sign_in",
        realmId: realm.id,
        recipientPhone: seed.phone,
        sessionName: "default",
        status: "sent",
      })
    }
    const app = usageAppCreate(database, testkit, usage)
    const url = `https://whatsapp-usage-window.example.com/realms/${realm.id}/whatsapp-otp/usage`

    const fetchUsage = async (query: string) => {
      const response = await app.request(`${url}${query}`, { headers: { cookie: `session=${adminToken}` } })
      expect(response.status).toBe(200)
      const body = (await response.json()) as WhatsappOtpUsageResponse
      expect(v.safeParse(whatsappOtpUsageResponseSchema, body).success).toBe(true)
      return body
    }

    const day = await fetchUsage("?window=24h")
    expect(day.recent.map((row) => row.recipientPhone)).toEqual(["+15550009101"])
    const threeDays = await fetchUsage("?window=3d")
    expect(threeDays.recent.map((row) => row.recipientPhone)).toEqual(["+15550009101", "+15550009102"])
    const sevenDays = await fetchUsage("?window=7d")
    expect(sevenDays.recent.map((row) => row.recipientPhone)).toEqual(["+15550009101", "+15550009102", "+15550009103"])
    const implicit = await fetchUsage("")
    expect(implicit.recent.map((row) => row.recipientPhone)).toEqual(["+15550009101"])

    for (const body of [day, threeDays, sevenDays, implicit]) {
      expect(body.totals).toEqual(day.totals)
      expect(body.requests).toEqual(day.requests)
      expect(body.attempts).toEqual(day.attempts)
      expect(body.senders).toEqual(day.senders)
      const serialized = JSON.stringify(body)
      for (const seed of seeds) expect(serialized.includes(seed.code)).toBe(false)
    }
    expect(day.totals).toEqual({ sentLastDay: 1, sentLastHour: 1 })

    const client = whatsappOtpApiClientCreate({
      baseUrl: "https://whatsapp-usage-window.example.com",
      fetch: async (input, init) =>
        app.request(input.toString(), { ...init, headers: { cookie: `session=${adminToken}` } }),
    })
    const clientResult = await client.whatsappOtpUsageGet(realm.id, { window: "7d" })
    expect(clientResult.success).toBe(true)
    if (!clientResult.success) return
    expect(clientResult.data.recent.map((row) => row.recipientPhone)).toEqual([
      "+15550009101",
      "+15550009102",
      "+15550009103",
    ])
  })
})

test("WhatsApp usage recent reports null phone and code for pre-Phase-2 rows", async () => {
  await withUsageDatabase(async (database, testkit) => {
    const realm = await createUsageRealm(database, "whatsapp-usage-legacy.example.com")
    const adminToken = await createUsageSession(database, realm.id, "usage-legacy-admin", true)
    const { sendAttempts, usage } = usageReaderCreate(database, testkit)
    const now = testkit.runtime.now()
    const hash = attemptSeed(sendAttempts, {
      createdAt: now - 5 * 60_000,
      endpointId: "primary",
      id: "usage-legacy-1",
      phoneNumber: "+15550009903",
      purpose: "sign_in",
      realmId: realm.id,
      sessionName: "default",
      status: "sent",
    })
    const app = usageAppCreate(database, testkit, usage)

    const response = await app.request(
      `https://whatsapp-usage-legacy.example.com/realms/${realm.id}/whatsapp-otp/usage`,
      { headers: { cookie: `session=${adminToken}` } },
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as WhatsappOtpUsageResponse
    expect(v.safeParse(whatsappOtpUsageResponseSchema, body).success).toBe(true)
    expect(body.recent).toHaveLength(1)
    expect(body.recent[0]).toMatchObject({
      code: null,
      recipientHashPrefix: hash.slice(0, 8),
      recipientPhone: null,
    })
  })
})

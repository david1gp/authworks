import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import type { WahaDeliveryPort } from "../domain/wahaDeliveryPort.js"
import { wahaHealthCandidateRepositoryCreate } from "../persistence/wahaHealthCandidateRepositoryCreate.js"
import { wahaSendAttemptRepositoryCreate } from "../persistence/wahaSendAttemptRepositoryCreate.js"
import type { WahaConfiguration } from "./wahaConfiguration.js"
import { wahaHealthRegistryCreate } from "./wahaHealthRegistryCreate.js"
import { wahaRecipientHashCreate } from "./wahaRecipientHashCreate.js"
import { wahaTextDeliveryCreate } from "./wahaTextDeliveryCreate.js"

type WahaDeliveryCall = Parameters<WahaDeliveryPort["sendText"]>[0]

function quotaConfiguration(options?: {
  readonly endpoints?: WahaConfiguration["endpoints"]
  readonly senderDailyLimit?: number
  readonly senderHourlyLimit?: number
}): WahaConfiguration {
  return {
    endpoints: options?.endpoints ?? [
      { client: { baseUrl: "https://primary.example.test" }, id: "primary" },
      { client: { baseUrl: "https://secondary.example.test" }, id: "secondary" },
    ],
    freshnessTtlMs: 60_000,
    refreshIntervalMs: 30_000,
    codeRedactionDisabled: false,
    senderDailyLimit: options?.senderDailyLimit ?? 10,
    senderHourlyLimit: options?.senderHourlyLimit ?? 2,
  }
}

function wahaDeliveryFakeCreate(behavior: (call: WahaDeliveryCall) => Result<void>): {
  readonly calls: WahaDeliveryCall[]
  readonly port: WahaDeliveryPort
} {
  const calls: WahaDeliveryCall[] = []
  return {
    calls,
    port: {
      sendText: async (input: WahaDeliveryCall) => {
        calls.push(input)
        return behavior(input)
      },
    },
  }
}

async function withQuotaDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-waha-send-quota-"))
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

function healthyCandidateCreate(endpointId: string, now: number) {
  return {
    checkedAt: now,
    createdAt: now,
    endpointId,
    expiresAt: now + 60_000,
    failureAt: null,
    failureCode: null,
    failureMessage: null,
    sessionName: "default",
    status: "healthy" as const,
    updatedAt: now,
    version: 1,
  }
}

function sentAttemptSeed(
  sendAttempts: ReturnType<typeof wahaSendAttemptRepositoryCreate>,
  input: { readonly createdAt: number; readonly endpointId: string; readonly id: string },
): void {
  const recorded = sendAttempts.wahaSendAttemptRecord({
    createdAt: input.createdAt,
    endpointId: input.endpointId,
    id: input.id,
    purpose: "sign_in",
    realmId: null,
    recipientPhoneHash: "seed-hash",
    sessionName: "default",
    status: "sent",
  })
  expect(recorded.success).toBe(true)
}

function quotaDeliveryCreate(
  database: StorageDatabase,
  testkit: ReturnType<typeof platformTestkitCreate>,
  configuration: WahaConfiguration,
  fake: { readonly port: WahaDeliveryPort },
) {
  const repository = wahaHealthCandidateRepositoryCreate(database.db)
  const sendAttempts = wahaSendAttemptRepositoryCreate(database.db)
  const delivery = wahaTextDeliveryCreate({
    configuration,
    deliveryPort: fake.port,
    healthRegistry: wahaHealthRegistryCreate({
      configuration,
      healthPort: { check: async () => resultCreate({ sessions: [], status: "ok" }) },
      repository,
      runtime: testkit.runtime,
    }),
    recipientHashSecret: "test-recipient-hash-secret",
    repository,
    runtime: testkit.runtime,
    sendAttempts,
  })
  return { delivery, repository, sendAttempts }
}

test("WAHA delivery skips a sender at its hourly limit and uses the next eligible sender", async () => {
  await withQuotaDatabase(async (database, testkit) => {
    const configuration = quotaConfiguration({ senderDailyLimit: 10, senderHourlyLimit: 2 })
    const fake = wahaDeliveryFakeCreate(() => resultCreate(undefined))
    const { delivery, repository, sendAttempts } = quotaDeliveryCreate(database, testkit, configuration, fake)
    const now = testkit.runtime.now()
    for (const endpointId of ["primary", "secondary"])
      expect(repository.wahaHealthCandidateCreate(healthyCandidateCreate(endpointId, now))).toMatchObject({
        success: true,
      })
    sentAttemptSeed(sendAttempts, { createdAt: now - 1_000, endpointId: "primary", id: "seed-primary-1" })
    sentAttemptSeed(sendAttempts, { createdAt: now - 2_000, endpointId: "primary", id: "seed-primary-2" })

    const sent = await delivery.sendText({
      code: "123456",
      phoneNumber: "+14155552671",
      purpose: "sign_in",
      realmId: "realm-1",
      text: "Your code is 123456.",
    })
    expect(sent).toEqual({ data: undefined, success: true })
    expect(fake.calls.map((call) => call.endpointId)).toEqual(["secondary"])

    const recent = sendAttempts.wahaSendAttemptListRecent(10, 0)
    expect(recent.success).toBe(true)
    if (!recent.success) return
    expect(
      recent.data.map((row) => ({
        code: row.code,
        endpointId: row.endpointId,
        purpose: row.purpose,
        realmId: row.realmId,
        recipientPhone: row.recipientPhone,
        sessionName: row.sessionName,
        status: row.status,
      })),
    ).toEqual([
      {
        code: "123456",
        endpointId: "secondary",
        purpose: "sign_in",
        realmId: "realm-1",
        recipientPhone: "+14155552671",
        sessionName: "default",
        status: "sent",
      },
      {
        code: null,
        endpointId: "primary",
        purpose: "sign_in",
        realmId: null,
        recipientPhone: null,
        sessionName: "default",
        status: "sent",
      },
      {
        code: null,
        endpointId: "primary",
        purpose: "sign_in",
        realmId: null,
        recipientPhone: null,
        sessionName: "default",
        status: "sent",
      },
    ])
  })
})

test("WAHA delivery records one blocked row and skips WAHA when every healthy sender is over quota", async () => {
  await withQuotaDatabase(async (database, testkit) => {
    const configuration = quotaConfiguration({ senderDailyLimit: 10, senderHourlyLimit: 1 })
    const fake = wahaDeliveryFakeCreate(() => resultCreate(undefined))
    const { delivery, repository, sendAttempts } = quotaDeliveryCreate(database, testkit, configuration, fake)
    const now = testkit.runtime.now()
    for (const endpointId of ["primary", "secondary"])
      expect(repository.wahaHealthCandidateCreate(healthyCandidateCreate(endpointId, now))).toMatchObject({
        success: true,
      })
    sentAttemptSeed(sendAttempts, { createdAt: now - 1_000, endpointId: "primary", id: "seed-primary-1" })
    sentAttemptSeed(sendAttempts, { createdAt: now - 1_000, endpointId: "secondary", id: "seed-secondary-1" })

    const sent = await delivery.sendText({
      code: "123456",
      phoneNumber: "+14155552671",
      text: "Your code is 123456.",
    })
    expect(sent).toMatchObject({ code: "waha.no-healthy-candidate", success: false })
    expect(fake.calls).toEqual([])

    const recent = sendAttempts.wahaSendAttemptListRecent(10, 0)
    expect(recent.success).toBe(true)
    if (!recent.success) return
    const blocked = recent.data.filter((row) => row.status === "blocked")
    expect(blocked).toHaveLength(1)
    expect(blocked[0]).toMatchObject({
      code: "123456",
      endpointId: "primary",
      purpose: "unknown",
      realmId: null,
      recipientPhone: "+14155552671",
      sessionName: null,
      status: "blocked",
    })
    expect(blocked[0]?.recipientPhoneHash).not.toBe("+14155552671")
  })
})

test("WAHA delivery records one blocked row and skips WAHA when no healthy candidate exists", async () => {
  await withQuotaDatabase(async (database, testkit) => {
    const configuration = quotaConfiguration()
    const fake = wahaDeliveryFakeCreate(() => resultCreate(undefined))
    const { delivery, sendAttempts } = quotaDeliveryCreate(database, testkit, configuration, fake)

    const sent = await delivery.sendText({ phoneNumber: "+14155552671", text: "Your code is 123456." })
    expect(sent).toMatchObject({ code: "waha.no-healthy-candidate", success: false })
    expect(fake.calls).toEqual([])

    const recent = sendAttempts.wahaSendAttemptListRecent(10, 0)
    expect(recent.success).toBe(true)
    if (!recent.success) return
    expect(recent.data).toHaveLength(1)
    expect(recent.data[0]).toMatchObject({
      endpointId: "primary",
      purpose: "unknown",
      realmId: null,
      sessionName: null,
      status: "blocked",
    })
  })
})

test("WAHA delivery records a sent row with the plaintext phone and code alongside the phone hash", async () => {
  await withQuotaDatabase(async (database, testkit) => {
    const configuration = quotaConfiguration()
    const fake = wahaDeliveryFakeCreate(() => resultCreate(undefined))
    const { delivery, repository, sendAttempts } = quotaDeliveryCreate(database, testkit, configuration, fake)
    const now = testkit.runtime.now()
    for (const endpointId of ["primary", "secondary"])
      expect(repository.wahaHealthCandidateCreate(healthyCandidateCreate(endpointId, now))).toMatchObject({
        success: true,
      })

    const sent = await delivery.sendText({
      code: "123456",
      phoneNumber: "+14155552671",
      purpose: "sign_in",
      realmId: "realm-1",
      text: "Your code is 123456.",
    })
    expect(sent).toEqual({ data: undefined, success: true })

    const recent = sendAttempts.wahaSendAttemptListRecent(10, 0)
    expect(recent.success).toBe(true)
    if (!recent.success) return
    expect(recent.data).toHaveLength(1)
    expect(recent.data[0]).toMatchObject({
      code: "123456",
      createdAt: now,
      purpose: "sign_in",
      realmId: "realm-1",
      recipientPhone: "+14155552671",
      sessionName: "default",
      status: "sent",
    })
    expect(recent.data[0]?.recipientPhoneHash).toBe(
      wahaRecipientHashCreate("test-recipient-hash-secret", "+14155552671"),
    )
    expect(recent.data[0]?.recipientPhoneHash).not.toContain("+14155552671")
  })
})

test("WAHA delivery records a failed row and still retries on a second candidate", async () => {
  await withQuotaDatabase(async (database, testkit) => {
    const configuration = quotaConfiguration()
    const fake = wahaDeliveryFakeCreate((call) =>
      call.endpointId === "primary"
        ? resultErrorCodedCreate(
            "wahaDeliveryPortSendText",
            "The WhatsApp message could not be delivered.",
            "waha.delivery-failed",
          )
        : resultCreate(undefined),
    )
    const { delivery, repository, sendAttempts } = quotaDeliveryCreate(database, testkit, configuration, fake)
    const now = testkit.runtime.now()
    for (const endpointId of ["primary", "secondary"])
      expect(repository.wahaHealthCandidateCreate(healthyCandidateCreate(endpointId, now))).toMatchObject({
        success: true,
      })

    const sent = await delivery.sendText({
      phoneNumber: "+14155552671",
      purpose: "registration",
      realmId: "realm-9",
      text: "Your code is 123456.",
    })
    expect(sent).toEqual({ data: undefined, success: true })
    expect(fake.calls.map((call) => call.endpointId)).toEqual(["primary", "secondary"])

    const recent = sendAttempts.wahaSendAttemptListRecent(10, 0)
    expect(recent.success).toBe(true)
    if (!recent.success) return
    expect(
      recent.data.map((row) => ({
        endpointId: row.endpointId,
        purpose: row.purpose,
        realmId: row.realmId,
        sessionName: row.sessionName,
        status: row.status,
      })),
    ).toEqual([
      { endpointId: "secondary", purpose: "registration", realmId: "realm-9", sessionName: "default", status: "sent" },
      { endpointId: "primary", purpose: "registration", realmId: "realm-9", sessionName: "default", status: "failed" },
    ])
    expect(repository.wahaHealthCandidateGet("primary", "default")).toMatchObject({
      data: { failureCode: "waha.delivery-failed", status: "unhealthy" },
      success: true,
    })
  })
})

test("WAHA delivery frees the hourly window after an hour while the daily window still counts", async () => {
  await withQuotaDatabase(async (database, testkit) => {
    const configuration = quotaConfiguration({
      endpoints: [{ client: { baseUrl: "https://primary.example.test" }, id: "primary" }],
      senderDailyLimit: 2,
      senderHourlyLimit: 1,
    })
    const fake = wahaDeliveryFakeCreate(() => resultCreate(undefined))
    const { delivery, repository, sendAttempts } = quotaDeliveryCreate(database, testkit, configuration, fake)
    const now = testkit.runtime.now()
    expect(
      repository.wahaHealthCandidateCreate({ ...healthyCandidateCreate("primary", now), expiresAt: now + 172_800_000 }),
    ).toMatchObject({
      success: true,
    })

    expect(await delivery.sendText({ phoneNumber: "+14155552671", text: "first" })).toEqual({
      data: undefined,
      success: true,
    })
    expect(await delivery.sendText({ phoneNumber: "+14155552671", text: "second" })).toMatchObject({
      code: "waha.no-healthy-candidate",
      success: false,
    })
    expect(fake.calls).toHaveLength(1)

    testkit.advance(3_600_001)
    expect(await delivery.sendText({ phoneNumber: "+14155552671", text: "third" })).toEqual({
      data: undefined,
      success: true,
    })
    testkit.advance(3_600_001)
    expect(await delivery.sendText({ phoneNumber: "+14155552671", text: "fourth" })).toMatchObject({
      code: "waha.no-healthy-candidate",
      success: false,
    })
    expect(fake.calls).toHaveLength(2)

    const sent = sendAttempts.wahaSendAttemptSentCount("primary", "default", testkit.runtime.now() - 86_400_000)
    expect(sent).toMatchObject({ data: 2, success: true })
    const recent = sendAttempts.wahaSendAttemptListRecent(10, 0)
    expect(recent.success).toBe(true)
    if (!recent.success) return
    expect(recent.data.map((row) => row.status)).toEqual(["blocked", "sent", "blocked", "sent"])
  })
})

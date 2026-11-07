import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { WhatsappOtpUsageResponse } from "../../whatsappOtp/public/whatsappOtpUsageResponseSchema.js"
import { wahaHealthCandidateRepositoryCreate } from "../persistence/wahaHealthCandidateRepositoryCreate.js"
import { wahaSendAttemptRepositoryCreate } from "../persistence/wahaSendAttemptRepositoryCreate.js"
import type { WahaConfiguration } from "./wahaConfiguration.js"
import { wahaConfigurationDefaults } from "./wahaConfigurationDefaults.js"

type WahaUsageReaderCreateOptions = {
  readonly configuration?: WahaConfiguration
  readonly repository: ReturnType<typeof wahaHealthCandidateRepositoryCreate>
  readonly requestedCountGet: (realmId: string, since: number) => Result<number>
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now">
  readonly sendAttempts: ReturnType<typeof wahaSendAttemptRepositoryCreate>
}

type WahaUsageSenderCounts = {
  readonly endpointId: string
  readonly healthy: boolean
  readonly sentLastDay: number
  readonly sentLastHour: number
  readonly sessionName: string
}

const wahaUsageHourMs = 3_600_000
const wahaUsageDayMs = 24 * 3_600_000
const wahaUsageRecentCap = 200
const wahaUsageHashPrefixLength = 8

export function wahaUsageReaderCreate(options: WahaUsageReaderCreateOptions) {
  return {
    // Implements the whatsappOtp usage port structurally; the composition call
    // site typechecks the shape so the features stay decoupled.
    whatsappOtpUsageGet(input: { readonly limit: number; readonly realmId: string }): Result<WhatsappOtpUsageResponse> {
      const op = "whatsappOtpUsageGet"
      const now = (options.runtime ?? runtimeCreate()).now()
      if (!Number.isSafeInteger(now) || now < 0)
        return resultErrorCodedCreate(op, "The WhatsApp usage timestamp is invalid.", "waha.invalid")
      const limits = {
        dailyPerSender: options.configuration?.senderDailyLimit ?? wahaConfigurationDefaults.senderDailyLimit,
        hourlyPerSender: options.configuration?.senderHourlyLimit ?? wahaConfigurationDefaults.senderHourlyLimit,
      }
      if ((options.configuration?.endpoints.length ?? 0) === 0) return resultCreate(wahaUsageEmptyCreate(limits))

      const senders = wahaUsageSendersRead(options, now)
      if (!senders.success) return senders
      const totals = {
        sentLastDay: senders.data.reduce((total, sender) => total + sender.sentLastDay, 0),
        sentLastHour: senders.data.reduce((total, sender) => total + sender.sentLastHour, 0),
      }
      const requests = wahaUsageRequestsRead(options, input.realmId, now)
      if (!requests.success) return requests
      const attempts = wahaUsageAttemptsRead(options, now)
      if (!attempts.success) return attempts
      const recent = options.sendAttempts.wahaSendAttemptListRecent(
        Math.max(0, Math.min(wahaUsageRecentCap, Math.floor(input.limit))),
      )
      if (!recent.success)
        return resultErrorCodedCreate(op, "The WhatsApp usage could not be read.", "waha.read-failed")
      return resultCreate({
        attempts: attempts.data,
        limits,
        recent: recent.data.map((row) => ({
          createdAt: row.createdAt,
          endpointId: row.endpointId,
          purpose: row.purpose,
          ...(row.realmId === null ? { realmId: null } : { realmId: row.realmId }),
          recipientHashPrefix: row.recipientPhoneHash.slice(0, wahaUsageHashPrefixLength),
          ...(row.sessionName === null ? { sessionName: null } : { sessionName: row.sessionName }),
          status: row.status,
        })),
        requests: requests.data,
        senders: senders.data.map((sender) => ({
          endpointId: sender.endpointId,
          healthy: sender.healthy,
          remainingDay: Math.max(0, limits.dailyPerSender - sender.sentLastDay),
          remainingHour: Math.max(0, limits.hourlyPerSender - sender.sentLastHour),
          sentLastDay: sender.sentLastDay,
          sentLastHour: sender.sentLastHour,
          sessionName: sender.sessionName,
        })),
        totals,
      })
    },
  }
}

function wahaUsageSendersRead(options: WahaUsageReaderCreateOptions, now: number): Result<WahaUsageSenderCounts[]> {
  const op = "whatsappOtpUsageGet"
  const configuredEndpoints = new Map(
    (options.configuration?.endpoints ?? []).map((endpoint) => [endpoint.id, endpoint]),
  )
  const candidates = options.repository.wahaHealthCandidateList()
  if (!candidates.success)
    return resultErrorCodedCreate(op, "The WhatsApp usage could not be read.", "waha.read-failed")
  const fresh = options.repository.wahaHealthCandidateListFreshHealthy(now)
  if (!fresh.success) return resultErrorCodedCreate(op, "The WhatsApp usage could not be read.", "waha.read-failed")
  const freshKeys = new Set(fresh.data.map((row) => wahaUsageSenderKeyCreate(row.endpointId, row.sessionName)))
  const hourCounts = options.sendAttempts.wahaSendAttemptSentCountBySender(now - wahaUsageHourMs)
  if (!hourCounts.success)
    return resultErrorCodedCreate(op, "The WhatsApp usage could not be read.", "waha.read-failed")
  const dayCounts = options.sendAttempts.wahaSendAttemptSentCountBySender(now - wahaUsageDayMs)
  if (!dayCounts.success) return resultErrorCodedCreate(op, "The WhatsApp usage could not be read.", "waha.read-failed")
  const hourlyBySender = new Map(
    hourCounts.data.map((row) => [wahaUsageSenderKeyCreate(row.endpointId, row.sessionName), row.sentCount]),
  )
  const dailyBySender = new Map(
    dayCounts.data.map((row) => [wahaUsageSenderKeyCreate(row.endpointId, row.sessionName), row.sentCount]),
  )
  return resultCreate(
    candidates.data
      .filter((candidate) => {
        const endpoint = configuredEndpoints.get(candidate.endpointId)
        return (
          endpoint !== undefined &&
          (endpoint.senderSessions === undefined || endpoint.senderSessions.includes(candidate.sessionName))
        )
      })
      .map((candidate) => ({
        endpointId: candidate.endpointId,
        healthy: freshKeys.has(wahaUsageSenderKeyCreate(candidate.endpointId, candidate.sessionName)),
        sentLastDay: dailyBySender.get(wahaUsageSenderKeyCreate(candidate.endpointId, candidate.sessionName)) ?? 0,
        sentLastHour: hourlyBySender.get(wahaUsageSenderKeyCreate(candidate.endpointId, candidate.sessionName)) ?? 0,
        sessionName: candidate.sessionName,
      })),
  )
}

function wahaUsageRequestsRead(
  options: WahaUsageReaderCreateOptions,
  realmId: string,
  now: number,
): Result<WhatsappOtpUsageResponse["requests"]> {
  const op = "whatsappOtpUsageGet"
  const lastHour = options.requestedCountGet(realmId, now - wahaUsageHourMs)
  if (!lastHour.success) return resultErrorCodedCreate(op, "The WhatsApp usage could not be read.", "waha.read-failed")
  const lastDay = options.requestedCountGet(realmId, now - wahaUsageDayMs)
  if (!lastDay.success) return resultErrorCodedCreate(op, "The WhatsApp usage could not be read.", "waha.read-failed")
  return resultCreate({ otpRequestedLastDay: lastDay.data, otpRequestedLastHour: lastHour.data })
}

function wahaUsageAttemptsRead(
  options: WahaUsageReaderCreateOptions,
  now: number,
): Result<WhatsappOtpUsageResponse["attempts"]> {
  const op = "whatsappOtpUsageGet"
  const byStatusLastHour = options.sendAttempts.wahaSendAttemptCountByStatus(now - wahaUsageHourMs)
  if (!byStatusLastHour.success)
    return resultErrorCodedCreate(op, "The WhatsApp usage could not be read.", "waha.read-failed")
  const byStatusLastDay = options.sendAttempts.wahaSendAttemptCountByStatus(now - wahaUsageDayMs)
  if (!byStatusLastDay.success)
    return resultErrorCodedCreate(op, "The WhatsApp usage could not be read.", "waha.read-failed")
  const byPurposeLastDay = options.sendAttempts.wahaSendAttemptCountByPurpose(now - wahaUsageDayMs)
  if (!byPurposeLastDay.success)
    return resultErrorCodedCreate(op, "The WhatsApp usage could not be read.", "waha.read-failed")
  return resultCreate({
    byPurposeLastDay: Object.fromEntries(byPurposeLastDay.data.map((row) => [row.purpose, row.count])),
    byStatusLastDay: wahaUsageStatusCountsCreate(byStatusLastDay.data),
    byStatusLastHour: wahaUsageStatusCountsCreate(byStatusLastHour.data),
  })
}

function wahaUsageStatusCountsCreate(
  rows: readonly { readonly count: number; readonly status: string }[],
): WhatsappOtpUsageResponse["attempts"]["byStatusLastHour"] {
  const counts = { blocked: 0, failed: 0, sent: 0 }
  for (const row of rows) {
    if (row.status === "sent" || row.status === "failed" || row.status === "blocked") counts[row.status] = row.count
  }
  return counts
}

function wahaUsageEmptyCreate(limits: WhatsappOtpUsageResponse["limits"]): WhatsappOtpUsageResponse {
  return {
    attempts: {
      byPurposeLastDay: {},
      byStatusLastDay: { blocked: 0, failed: 0, sent: 0 },
      byStatusLastHour: { blocked: 0, failed: 0, sent: 0 },
    },
    limits,
    recent: [],
    requests: { otpRequestedLastDay: 0, otpRequestedLastHour: 0 },
    senders: [],
    totals: { sentLastDay: 0, sentLastHour: 0 },
  }
}

function wahaUsageSenderKeyCreate(endpointId: string, sessionName: string | null): string {
  return `${endpointId}\u0000${sessionName ?? ""}`
}

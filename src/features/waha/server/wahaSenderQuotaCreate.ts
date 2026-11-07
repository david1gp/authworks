import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { wahaSendAttemptRepositoryCreate } from "../persistence/wahaSendAttemptRepositoryCreate.js"
import type { WahaHealthCandidateRow } from "../persistence/wahaHealthCandidateTable.js"
import type { WahaConfiguration } from "./wahaConfiguration.js"

type WahaSenderQuotaCreateOptions = {
  readonly configuration: WahaConfiguration
  readonly sendAttempts: ReturnType<typeof wahaSendAttemptRepositoryCreate>
}

const wahaSenderQuotaHourMs = 3_600_000
const wahaSenderQuotaDayMs = 24 * 3_600_000

export function wahaSenderQuotaCreate(options: WahaSenderQuotaCreateOptions) {
  return {
    wahaSenderQuotaEligibleList(
      candidates: readonly WahaHealthCandidateRow[],
      now: number,
    ): Result<WahaHealthCandidateRow[]> {
      const hourCounts = options.sendAttempts.wahaSendAttemptSentCountBySender(now - wahaSenderQuotaHourMs)
      if (!hourCounts.success) return hourCounts
      const dayCounts = options.sendAttempts.wahaSendAttemptSentCountBySender(now - wahaSenderQuotaDayMs)
      if (!dayCounts.success) return dayCounts
      const hourlyBySender = new Map(
        hourCounts.data.map((row) => [wahaSenderQuotaKeyCreate(row.endpointId, row.sessionName), row.sentCount]),
      )
      const dailyBySender = new Map(
        dayCounts.data.map((row) => [wahaSenderQuotaKeyCreate(row.endpointId, row.sessionName), row.sentCount]),
      )
      return resultCreate(
        candidates.filter(
          (candidate) =>
            (hourlyBySender.get(wahaSenderQuotaKeyCreate(candidate.endpointId, candidate.sessionName)) ?? 0) <
              options.configuration.senderHourlyLimit &&
            (dailyBySender.get(wahaSenderQuotaKeyCreate(candidate.endpointId, candidate.sessionName)) ?? 0) <
              options.configuration.senderDailyLimit,
        ),
      )
    },
  }
}

function wahaSenderQuotaKeyCreate(endpointId: string, sessionName: string | null): string {
  return `${endpointId}\u0000${sessionName ?? ""}`
}

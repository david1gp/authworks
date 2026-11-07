import type { Result } from "#result"
import { wahaHealthCandidateRepositoryCreate } from "../persistence/wahaHealthCandidateRepositoryCreate.js"
import type { WahaHealthCandidateRow } from "../persistence/wahaHealthCandidateTable.js"
import { wahaSenderQuotaCreate } from "./wahaSenderQuotaCreate.js"

type WahaHealthCandidateReaderCreateOptions = {
  readonly quota?: ReturnType<typeof wahaSenderQuotaCreate>
  readonly repository: ReturnType<typeof wahaHealthCandidateRepositoryCreate>
}

export function wahaHealthCandidateReaderCreate(options: WahaHealthCandidateReaderCreateOptions) {
  return {
    wahaHealthCandidateFreshHealthyList(now: number): Result<WahaHealthCandidateRow[]> {
      return options.repository.wahaHealthCandidateListFreshHealthy(now)
    },
    wahaHealthCandidateFreshHealthyUnderQuotaList(now: number): Result<WahaHealthCandidateRow[]> {
      const fresh = options.repository.wahaHealthCandidateListFreshHealthy(now)
      if (!fresh.success) return fresh
      if (options.quota === undefined) return fresh
      return options.quota.wahaSenderQuotaEligibleList(fresh.data, now)
    },
  }
}

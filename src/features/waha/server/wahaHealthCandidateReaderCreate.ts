import type { Result } from "#result"
import { wahaHealthCandidateRepositoryCreate } from "../persistence/wahaHealthCandidateRepositoryCreate.js"
import type { WahaHealthCandidateRow } from "../persistence/wahaHealthCandidateTable.js"

type WahaHealthCandidateReaderCreateOptions = {
  readonly repository: ReturnType<typeof wahaHealthCandidateRepositoryCreate>
}

export function wahaHealthCandidateReaderCreate(options: WahaHealthCandidateReaderCreateOptions) {
  return {
    wahaHealthCandidateFreshHealthyList(now: number): Result<WahaHealthCandidateRow[]> {
      return options.repository.wahaHealthCandidateListFreshHealthy(now)
    },
  }
}

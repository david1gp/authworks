import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import { wahaHealthCandidateRepositoryCreate } from "../persistence/wahaHealthCandidateRepositoryCreate.js"
import type { WahaHealthCandidateRow } from "../persistence/wahaHealthCandidateTable.js"

type WahaHealthCandidateKey = Pick<WahaHealthCandidateRow, "endpointId" | "sessionName">

type WahaHealthCandidateSelectorCreateOptions = {
  readonly repository: ReturnType<typeof wahaHealthCandidateRepositoryCreate>
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

export function wahaHealthCandidateSelectorCreate(options: WahaHealthCandidateSelectorCreateOptions) {
  const runtime = options.runtime ?? runtimeCreate()

  return {
    select(excluded: readonly WahaHealthCandidateKey[] = []): Result<WahaHealthCandidateRow | null> {
      const op = "wahaHealthCandidateSelect"
      const now = runtime.now()
      if (!Number.isSafeInteger(now) || now < 0)
        return resultErrorCodedCreate(op, "The WAHA candidate timestamp is invalid.", "waha.internal")

      const candidates = options.repository.wahaHealthCandidateListFreshHealthy(now)
      if (!candidates.success) return candidates

      const excludedKeys = new Set(excluded.map(wahaHealthCandidateKeyCreate))
      const available = candidates.data.filter(
        (candidate) => !excludedKeys.has(wahaHealthCandidateKeyCreate(candidate)),
      )
      if (available.length === 0) return resultCreate(null)
      if (available.length === 1) return resultCreate(available[0] ?? null)

      const index = wahaHealthCandidateRandomIndexCreate(available.length, runtime.randomBytes)
      if (!index.success) return index
      return resultCreate(available[index.data] ?? null)
    },
  }
}

function wahaHealthCandidateKeyCreate(candidate: WahaHealthCandidateKey): string {
  return `${candidate.endpointId}\u0000${candidate.sessionName}`
}

function wahaHealthCandidateRandomIndexCreate(
  candidateCount: number,
  randomBytes: (length: number) => Uint8Array,
): Result<number> {
  const op = "wahaHealthCandidateSelect"
  const randomMaximum = 0x1_0000_0000
  const randomLimit = Math.floor(randomMaximum / candidateCount) * candidateCount

  for (let attempt = 0; attempt < 16; attempt += 1) {
    let bytes: Uint8Array
    try {
      bytes = randomBytes(4)
    } catch (_error) {
      return resultErrorCodedCreate(op, "A WAHA candidate could not be selected.", "waha.internal")
    }
    if (bytes.length !== 4)
      return resultErrorCodedCreate(op, "A WAHA candidate could not be selected.", "waha.internal")

    const randomValue =
      (bytes[0] ?? 0) * 0x1000000 + (bytes[1] ?? 0) * 0x10000 + (bytes[2] ?? 0) * 0x100 + (bytes[3] ?? 0)
    if (randomValue >= randomLimit) continue
    return resultCreate(randomValue % candidateCount)
  }

  return resultErrorCodedCreate(op, "A WAHA candidate could not be selected.", "waha.internal")
}

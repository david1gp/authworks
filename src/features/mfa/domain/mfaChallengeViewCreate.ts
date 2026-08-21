import type { MfaChallengeRow } from "../persistence/mfaChallengeTable.js"
import type { MfaChallenge } from "../public/mfaChallengeSchema.js"

export function mfaChallengeViewCreate(row: MfaChallengeRow): MfaChallenge {
  return {
    expiresAt: row.expiresAt,
    id: row.id,
    purpose: row.purpose as MfaChallenge["purpose"],
    requiredAssurance: "multi_factor",
  }
}

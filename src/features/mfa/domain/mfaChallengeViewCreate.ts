import * as v from "valibot"
import type { MfaChallengeRow } from "../persistence/mfaChallengeTable.js"
import type { MfaChallenge } from "../public/mfaChallengeSchema.js"
import { mfaFactorSchema } from "../public/mfaFactorSchema.js"

export function mfaChallengeViewCreate(row: MfaChallengeRow): MfaChallenge {
  const availableFactors = mfaChallengeFactorsParse(row.availableFactors)
  return {
    ...(availableFactors === undefined ? {} : { availableFactors }),
    expiresAt: row.expiresAt,
    id: row.id,
    purpose: row.purpose as MfaChallenge["purpose"],
    requiredAssurance: "multi_factor",
    ...(mfaFactorParse(row.factor) === undefined ? {} : { factor: mfaFactorParse(row.factor) }),
  }
}

function mfaChallengeFactorsParse(value: string | null): MfaChallenge["availableFactors"] {
  if (value === null) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return undefined
    const factors = parsed.flatMap((factor) => {
      const checked = v.safeParse(mfaFactorSchema, factor)
      return checked.success ? [checked.output] : []
    })
    return factors.length === parsed.length ? factors : undefined
  } catch (_error) {
    return undefined
  }
}

function mfaFactorParse(value: string | null): MfaChallenge["factor"] {
  const checked = v.safeParse(mfaFactorSchema, value)
  return checked.success ? checked.output : undefined
}

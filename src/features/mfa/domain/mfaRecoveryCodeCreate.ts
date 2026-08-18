import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"

const mfaRecoveryAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function mfaRecoveryCodeCreate(runtime: Pick<ReturnType<typeof runtimeCreate>, "randomBytes">): Result<string> {
  try {
    const bytes = runtime.randomBytes(12)
    let value = ""
    for (const byte of bytes) value += mfaRecoveryAlphabet[byte % mfaRecoveryAlphabet.length]
    return resultCreate(`${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8)}`)
  } catch (_error) {
    return resultErrorCreate("mfaRecoveryCodeCreate", "The recovery code could not be created.", "mfa.write-failed")
  }
}

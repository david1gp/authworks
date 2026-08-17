import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"

const mfaTotpAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

export function mfaTotpSecretCreate(runtime: Pick<ReturnType<typeof runtimeCreate>, "randomBytes">): Result<string> {
  const op = "mfaTotpSecretCreate"
  try {
    const bytes = runtime.randomBytes(20)
    let value = ""
    let buffer = 0
    let bits = 0
    for (const byte of bytes) {
      buffer = (buffer << 8) | byte
      bits += 8
      while (bits >= 5) {
        bits -= 5
        value += mfaTotpAlphabet[(buffer >>> bits) & 31]
      }
    }
    if (bits > 0) value += mfaTotpAlphabet[(buffer << (5 - bits)) & 31]
    if (value.length < 32) return resultErrorCreate(op, "The TOTP secret could not be created.")
    return resultCreate(value)
  } catch (_error) {
    return resultErrorCreate(op, "The TOTP secret could not be created.")
  }
}

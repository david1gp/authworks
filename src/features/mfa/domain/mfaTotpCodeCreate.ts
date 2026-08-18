import { createHmac } from "node:crypto"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

export function mfaTotpCodeCreate(secret: string, counter: number): Result<string> {
  const op = "mfaTotpCodeCreate"
  if (!/^[A-Z2-7]{16,128}$/.test(secret) || !Number.isSafeInteger(counter) || counter < 0)
    return resultErrorCreate(op, "The TOTP value is invalid.", "mfa.invalid")
  try {
    const key = mfaTotpBase32Decode(secret)
    if (key === null) return resultErrorCreate(op, "The TOTP value is invalid.", "mfa.invalid")
    const digest = createHmac("sha1", key).update(mfaTotpCounterEncode(counter)).digest()
    const offset = digest[digest.length - 1]! & 0x0f
    const value =
      ((digest[offset]! & 0x7f) << 24) | (digest[offset + 1]! << 16) | (digest[offset + 2]! << 8) | digest[offset + 3]!
    return resultCreate(String(value % 1_000_000).padStart(6, "0"))
  } catch (_error) {
    return resultErrorCreate(op, "The TOTP value is invalid.", "mfa.invalid")
  }
}

function mfaTotpBase32Decode(value: string): Uint8Array | null {
  let buffer = 0
  let bits = 0
  const output: number[] = []
  for (const character of value) {
    const index = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(character)
    if (index < 0) return null
    buffer = (buffer << 5) | index
    bits += 5
    if (bits >= 8) {
      bits -= 8
      output.push((buffer >>> bits) & 255)
    }
  }
  return new Uint8Array(output)
}

function mfaTotpCounterEncode(counter: number): Uint8Array {
  const value = new Uint8Array(8)
  let remainder = counter
  for (let index = 7; index >= 0; index -= 1) {
    value[index] = remainder % 256
    remainder = Math.floor(remainder / 256)
  }
  return value
}

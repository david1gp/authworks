import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { mfaTotpCodeCreate } from "./mfaTotpCodeCreate.js"

export function mfaTotpCodeVerify(
  secret: string,
  code: string,
  now: number,
  window: number,
  lastUsedStep?: number | null,
): Result<number> {
  const op = "mfaTotpCodeVerify"
  if (
    !/^\d{6}$/.test(code) ||
    !Number.isSafeInteger(now) ||
    now < 0 ||
    !Number.isInteger(window) ||
    window < 0 ||
    window > 2
  )
    return resultErrorCreate(op, "The TOTP code is invalid.", "mfa.invalid")
  const currentStep = Math.floor(now / 30_000)
  for (let offset = -window; offset <= window; offset += 1) {
    const step = currentStep + offset
    if (step < 0 || (lastUsedStep !== null && lastUsedStep !== undefined && step <= lastUsedStep)) continue
    const expected = mfaTotpCodeCreate(secret, step)
    if (expected.success && mfaTotpConstantTimeEqual(expected.data, code)) return resultCreate(step)
  }
  return resultErrorCreate(op, "The TOTP code is invalid.", "mfa.invalid")
}

function mfaTotpConstantTimeEqual(actual: string, expected: string): boolean {
  let difference = actual.length ^ expected.length
  const length = Math.max(actual.length, expected.length)
  for (let index = 0; index < length; index += 1)
    difference |= (actual.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0)
  return difference === 0
}

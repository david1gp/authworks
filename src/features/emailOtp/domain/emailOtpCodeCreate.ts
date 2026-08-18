import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"

const emailOtpCodeMaximum = 1_000_000
const emailOtpCodeRandomMaximum = 0x1_0000_0000
const emailOtpCodeRandomLimit = Math.floor(emailOtpCodeRandomMaximum / emailOtpCodeMaximum) * emailOtpCodeMaximum

export function emailOtpCodeCreate(
  runtime: Pick<ReturnType<typeof runtimeCreate>, "randomBytes"> = runtimeCreate(),
): Result<string> {
  const op = "emailOtpCodeCreate"
  try {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const bytes = runtime.randomBytes(4)
      if (bytes.length !== 4)
        return resultErrorCreate(op, "The email OTP code could not be created.", "email-otp.internal")
      const randomValue = ((bytes[0] ?? 0) << 24) | ((bytes[1] ?? 0) << 16) | ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0)
      const unsignedValue = randomValue >>> 0
      if (unsignedValue >= emailOtpCodeRandomLimit) continue
      return resultCreate(String(unsignedValue % emailOtpCodeMaximum).padStart(6, "0"))
    }
    return resultErrorCreate(op, "The email OTP code could not be created.", "email-otp.internal")
  } catch (_error) {
    return resultErrorCreate(op, "The email OTP code could not be created.", "email-otp.internal")
  }
}

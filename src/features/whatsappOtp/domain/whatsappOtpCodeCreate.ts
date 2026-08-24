import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"

const whatsappOtpCodeMaximum = 1_000_000
const whatsappOtpCodeRandomMaximum = 0x1_0000_0000
const whatsappOtpCodeRandomLimit =
  Math.floor(whatsappOtpCodeRandomMaximum / whatsappOtpCodeMaximum) * whatsappOtpCodeMaximum

export function whatsappOtpCodeCreate(
  runtime: Pick<ReturnType<typeof runtimeCreate>, "randomBytes"> = runtimeCreate(),
): Result<string> {
  const op = "whatsappOtpCodeCreate"
  try {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const bytes = runtime.randomBytes(4)
      if (bytes.length !== 4)
        return resultErrorCreate(op, "The WhatsApp OTP code could not be created.", "whatsapp-otp.internal")
      const randomValue = ((bytes[0] ?? 0) << 24) | ((bytes[1] ?? 0) << 16) | ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0)
      const unsignedValue = randomValue >>> 0
      if (unsignedValue >= whatsappOtpCodeRandomLimit) continue
      return resultCreate(String(unsignedValue % whatsappOtpCodeMaximum).padStart(6, "0"))
    }
    return resultErrorCreate(op, "The WhatsApp OTP code could not be created.", "whatsapp-otp.internal")
  } catch (_error) {
    return resultErrorCreate(op, "The WhatsApp OTP code could not be created.", "whatsapp-otp.internal")
  }
}

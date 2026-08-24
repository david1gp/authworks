import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"

const passwordRegistrationCodeMaximum = 1_000_000
const passwordRegistrationCodeRandomMaximum = 0x1_0000_0000
const passwordRegistrationCodeRandomLimit =
  Math.floor(passwordRegistrationCodeRandomMaximum / passwordRegistrationCodeMaximum) * passwordRegistrationCodeMaximum

export function passwordRegistrationCodeCreate(
  runtime: Pick<ReturnType<typeof runtimeCreate>, "randomBytes"> = runtimeCreate(),
): Result<string> {
  const op = "passwordRegistrationCodeCreate"
  try {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const bytes = runtime.randomBytes(4)
      if (bytes.length !== 4)
        return resultErrorCreate(op, "The registration code could not be created.", "passwords.write-failed")
      const randomValue = ((bytes[0] ?? 0) << 24) | ((bytes[1] ?? 0) << 16) | ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0)
      const unsignedValue = randomValue >>> 0
      if (unsignedValue >= passwordRegistrationCodeRandomLimit) continue
      return resultCreate(String(unsignedValue % passwordRegistrationCodeMaximum).padStart(6, "0"))
    }
    return resultErrorCreate(op, "The registration code could not be created.", "passwords.write-failed")
  } catch (_error) {
    return resultErrorCreate(op, "The registration code could not be created.", "passwords.write-failed")
  }
}

import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { userPhoneNumberSchema } from "../public/userPhoneNumberSchema.js"
import { userRegistrationVerificationMethodSchema } from "../public/userRegistrationVerificationMethodSchema.js"

type UserStateInvariant = {
  readonly emailVerifiedAt: number | null
  readonly phoneNumber: string | null
  readonly phoneNumberVerifiedAt: number | null
  readonly registrationVerifiedAt: number | null
  readonly registrationVerificationMethod: string | null
}

export function userStateInvariantValidate(input: UserStateInvariant): Result<void> {
  const op = "userStateInvariantValidate"
  const timestamps = [input.emailVerifiedAt, input.phoneNumberVerifiedAt, input.registrationVerifiedAt]
  if (timestamps.some((timestamp) => timestamp !== null && (!Number.isSafeInteger(timestamp) || timestamp < 0)))
    return resultErrorCreate(op, "The user verification state transition is invalid.", "users.invalid-transition")

  if (input.phoneNumber !== null && !v.safeParse(userPhoneNumberSchema, input.phoneNumber).success)
    return resultErrorCreate(op, "The user verification state transition is invalid.", "users.invalid-transition")
  if (input.phoneNumberVerifiedAt !== null && input.phoneNumber === null)
    return resultErrorCreate(op, "The user verification state transition is invalid.", "users.invalid-transition")

  const registrationMethodSet = input.registrationVerificationMethod !== null
  const registrationTimestampSet = input.registrationVerifiedAt !== null
  if (registrationMethodSet !== registrationTimestampSet)
    return resultErrorCreate(op, "The user verification state transition is invalid.", "users.invalid-transition")
  if (!registrationMethodSet) return resultCreate(undefined)

  const method = v.safeParse(userRegistrationVerificationMethodSchema, input.registrationVerificationMethod)
  if (!method.success)
    return resultErrorCreate(op, "The user verification state transition is invalid.", "users.invalid-transition")
  if (method.output === "email" && input.emailVerifiedAt === null)
    return resultErrorCreate(op, "The user verification state transition is invalid.", "users.invalid-transition")
  if (method.output === "whatsapp" && input.phoneNumberVerifiedAt === null)
    return resultErrorCreate(op, "The user verification state transition is invalid.", "users.invalid-transition")
  return resultCreate(undefined)
}

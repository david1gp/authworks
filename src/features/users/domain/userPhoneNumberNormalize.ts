import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { userPhoneNumberSchema } from "../public/userPhoneNumberSchema.js"

export function userPhoneNumberNormalize(input: string): Result<string> {
  const op = "userPhoneNumberNormalize"
  const parsed = v.safeParse(userPhoneNumberSchema, input.trim())
  if (!parsed.success) return resultErrorCreate(op, "The user phone number is invalid.", "users.invalid-phone-number")
  return resultCreate(parsed.output)
}

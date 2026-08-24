import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

const wahaE164PhoneNumberSchema = v.pipe(v.string(), v.regex(/^\+[1-9]\d{1,14}$/))

export function wahaChatIdCreate(phoneNumber: string): Result<string> {
  const op = "wahaChatIdCreate"
  const parsed = v.safeParse(wahaE164PhoneNumberSchema, phoneNumber)
  if (!parsed.success) return resultErrorCodedCreate(op, "The WhatsApp phone number is invalid.", "waha.invalid")
  return resultCreate(`${parsed.output.slice(1)}@c.us`)
}

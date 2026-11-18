import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

const appleUserFieldSchema = v.strictObject({
  email: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(320))),
  name: v.optional(
    v.strictObject({
      firstName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
      lastName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
    }),
  ),
})

export type AppleUserField = v.InferOutput<typeof appleUserFieldSchema>

/**
 * Parses the `user` form field Apple POSTs to the callback on the first authorization
 * for a user (`{"name":{"firstName","lastName"},"email"}`). Later authorizations omit
 * it, so absent or empty input parses to null rather than an error.
 */
export function appleUserFieldParse(raw: unknown): Result<AppleUserField | null> {
  const op = "appleUserFieldParse"
  if (raw === undefined || raw === null) return resultCreate(null)
  if (typeof raw !== "string" || raw.trim().length === 0) {
    if (typeof raw === "string") return resultCreate(null)
    return resultErrorCreate(op, "The Apple user field is invalid.", "external-identities.invalid")
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch (_error) {
    return resultErrorCreate(op, "The Apple user field is invalid.", "external-identities.invalid")
  }
  const validated = v.safeParse(appleUserFieldSchema, parsed)
  if (!validated.success)
    return resultErrorCreate(op, "The Apple user field is invalid.", "external-identities.invalid")
  const email = validated.output.email?.trim()
  const firstName = validated.output.name?.firstName?.trim()
  const lastName = validated.output.name?.lastName?.trim()
  if (
    (email === undefined || email.length === 0) &&
    (firstName === undefined || firstName.length === 0) &&
    (lastName === undefined || lastName.length === 0)
  )
    return resultCreate(null)
  return resultCreate({
    ...(email !== undefined && email.length > 0 ? { email } : {}),
    ...((firstName !== undefined && firstName.length > 0) || (lastName !== undefined && lastName.length > 0)
      ? {
          name: {
            ...(firstName !== undefined && firstName.length > 0 ? { firstName } : {}),
            ...(lastName !== undefined && lastName.length > 0 ? { lastName } : {}),
          },
        }
      : {}),
  })
}

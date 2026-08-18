import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

export function userEmailNormalize(input: string): Result<string> {
  const op = "userEmailNormalize"
  const email = input.trim().toLowerCase()
  if (email.length === 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return resultErrorCreate(op, "The user email is invalid.", "users.invalid-email")
  return resultCreate(email)
}

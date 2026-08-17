import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

export function userEmailNormalize(input: string): Result<string> {
  const op = "userEmailNormalize"
  const email = input.trim().toLowerCase()
  if (email.length === 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return resultErrorCreate(op, "The user email is invalid.")
  return resultCreate(email)
}

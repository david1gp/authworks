import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

export function userNameNormalize(input: string): Result<string> {
  const op = "userNameNormalize"
  const userName = input.trim().toLowerCase()
  if (userName.length === 0) return resultErrorCreate(op, "The user name is invalid.", "users.invalid-name")
  return resultCreate(userName)
}

import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

export function userNameNormalize(input: string): Result<string> {
  const op = "userNameNormalize"
  const userName = input.trim().toLowerCase()
  if (userName.length === 0) return resultErrorCreate(op, "The user name is invalid.")
  return resultCreate(userName)
}

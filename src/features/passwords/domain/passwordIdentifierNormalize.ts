import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

export function passwordIdentifierNormalize(input: string): Result<string> {
  const op = "passwordIdentifierNormalize"
  const identifier = input.trim().toLowerCase()
  if (identifier.length === 0 || identifier.length > 320)
    return resultErrorCreate(op, "The login identifier is invalid.")
  return resultCreate(identifier)
}

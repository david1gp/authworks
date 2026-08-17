import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

export function organizationNameNormalize(input: string): Result<string> {
  const op = "organizationNameNormalize"
  const name = input.trim()
  if (name.length === 0 || name.length > 128) return resultErrorCreate(op, "The organization name is invalid.")
  return resultCreate(name)
}

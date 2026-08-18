import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

export function organizationNameNormalize(input: string): Result<string> {
  const op = "organizationNameNormalize"
  const name = input.trim()
  if (name.length === 0 || name.length > 128)
    return resultErrorCodedCreate(op, "The organization name is invalid.", "organizations.invalid")
  return resultCreate(name)
}

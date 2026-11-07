import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

export function teamNameNormalize(input: string): Result<string> {
  const op = "teamNameNormalize"
  const name = input.trim()
  if (name.length === 0 || name.length > 128)
    return resultErrorCodedCreate(op, "The team name is invalid.", "teams.invalid")
  return resultCreate(name)
}

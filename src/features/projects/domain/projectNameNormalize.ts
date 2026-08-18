import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

export function projectNameNormalize(input: string): Result<string> {
  const op = "projectNameNormalize"
  const value = input.trim()
  if (value.length === 0)
    return resultErrorCodedCreate(op, "The project name must not be empty.", "projects.name-invalid")
  if (value.length > 200) return resultErrorCodedCreate(op, "The project name is too long.", "projects.name-invalid")
  return resultCreate(value)
}

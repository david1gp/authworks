import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

export function projectNameNormalize(input: string): Result<string> {
  const op = "projectNameNormalize"
  const value = input.trim()
  if (value.length === 0) return resultErrorCreate(op, "The project name must not be empty.")
  if (value.length > 200) return resultErrorCreate(op, "The project name is too long.")
  return resultCreate(value)
}

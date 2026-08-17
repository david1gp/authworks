import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

export function projectApplicationNameNormalize(input: string): Result<string> {
  const op = "projectApplicationNameNormalize"
  const value = input.trim()
  if (value.length === 0) return resultErrorCreate(op, "The application name must not be empty.")
  if (value.length > 200) return resultErrorCreate(op, "The application name is too long.")
  return resultCreate(value)
}

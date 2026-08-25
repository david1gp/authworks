import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

const connectionProfileNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

export function connectionProfileNameValidate(name: unknown): Result<string> {
  const op = "connectionProfileNameValidate"
  if (typeof name === "string" && connectionProfileNamePattern.test(name)) return resultCreate(name)
  return resultErrorCreate(
    op,
    "The connection profile name must be 1-64 characters, begin with a letter or number, and contain only letters, numbers, '.', '_' or '-'.",
  )
}

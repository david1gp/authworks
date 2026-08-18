import { type Result } from "#result"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCodedCreate } from "../errors/resultErrorCodedCreate.js"

export function listSortByResolve(
  sortBy: string | undefined,
  allowed: readonly string[],
  fallback: string,
): Result<string> {
  const resolved = sortBy ?? fallback
  if (!allowed.includes(resolved))
    return resultErrorCodedCreate("listSortByResolve", "The list sort field is invalid.", "platform.invalid-page")
  return resultCreate(resolved)
}

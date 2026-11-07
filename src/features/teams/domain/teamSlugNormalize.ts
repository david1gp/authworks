import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

export function teamSlugNormalize(input: string): Result<string> {
  const op = "teamSlugNormalize"
  const slug = input.trim()
  if (slug.length === 0 || slug.length > 64 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    return resultErrorCodedCreate(op, "The team slug is invalid.", "teams.invalid")
  if (slug === "unassigned") return resultErrorCodedCreate(op, "The team slug is reserved.", "teams.invalid")
  return resultCreate(slug)
}

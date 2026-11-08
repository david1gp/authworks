import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

export function organizationSlugNormalize(input: string): Result<string> {
  const op = "organizationSlugNormalize"
  const slug = input.trim()
  if (slug.length === 0 || slug.length > 64 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    return resultErrorCodedCreate(op, "The organization slug is invalid.", "organizations.invalid")
  if (slug === "new" || slug === "unassigned")
    return resultErrorCodedCreate(op, "The organization slug is reserved.", "organizations.invalid")
  return resultCreate(slug)
}

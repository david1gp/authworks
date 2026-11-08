import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

/**
 * Resolves a unique organization slug from a suggested base: returns the base
 * when it is free, otherwise appends `-2`, `-3`, … (truncating the stem to fit
 * 64 characters) until a free candidate is found.
 */
export function organizationSlugUniqueResolve(
  base: string,
  slugTaken: (slug: string) => Result<boolean>,
): Result<string> {
  const op = "organizationSlugUniqueResolve"
  let candidate = base
  let counter = 2
  for (;;) {
    const taken = slugTaken(candidate)
    if (!taken.success) return taken
    if (!taken.data) return resultCreate(candidate)
    const suffix = `-${counter}`
    if (suffix.length >= 64)
      return resultErrorCodedCreate(op, "The organization slug is invalid.", "organizations.invalid")
    candidate = `${base.slice(0, 64 - suffix.length).replace(/-+$/, "")}${suffix}`
    counter += 1
  }
}

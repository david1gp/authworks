import { type Result } from "#result"
import { listPageSizeResolve } from "./listPageSizeResolve.js"
import { listQueryParse } from "./listQueryParse.js"
import type { ListQuery } from "./listQuerySchema.js"

/**
 * Parses pagination/search/sort params into a `ListQuery`. Extra filter params (for
 * example `organizationId`, `role`, `state`) are silently dropped: routes read them
 * separately against their own schemas. Unknown value types still fail validation.
 */
export function listQueryFromSearchParams(
  input: URLSearchParams | Readonly<Record<string, string>>,
  options?: { readonly parameters?: readonly string[] },
): Result<ListQuery> {
  const entries = input instanceof URLSearchParams ? [...input.entries()] : Object.entries(input)
  const allowed = new Set([
    "pageSize",
    "pageToken",
    "search",
    "sortBy",
    "sortDirection",
    ...(options?.parameters ?? []),
  ])
  const queryInput: Record<string, unknown> = Object.fromEntries(entries.filter(([key]) => allowed.has(key)))
  if (typeof queryInput.pageSize === "string") queryInput.pageSize = Number(queryInput.pageSize)
  if (typeof queryInput.pageSize === "number" && Number.isFinite(queryInput.pageSize))
    queryInput.pageSize = listPageSizeResolve(queryInput.pageSize)
  return listQueryParse(queryInput)
}

import { type Result } from "#result"
import { listQueryParse } from "./listQueryParse.js"
import type { ListQuery } from "./listQuerySchema.js"

export function listQueryFromSearchParams(
  input: URLSearchParams | Readonly<Record<string, string>>,
): Result<ListQuery> {
  const entries = input instanceof URLSearchParams ? [...input.entries()] : Object.entries(input)
  const queryInput: Record<string, unknown> = Object.fromEntries(entries)
  if (typeof queryInput.pageSize === "string") queryInput.pageSize = Number(queryInput.pageSize)
  return listQueryParse(queryInput)
}

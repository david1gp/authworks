import type { ListQuery } from "./listQuerySchema.js"

export function listQueryToSearchParams(query: ListQuery | undefined): string {
  if (query === undefined) return ""
  const params = new URLSearchParams()
  if (query.pageSize !== undefined) params.set("pageSize", String(query.pageSize))
  if (query.pageToken !== undefined) params.set("pageToken", query.pageToken)
  if (query.sortBy !== undefined) params.set("sortBy", query.sortBy)
  if (query.sortDirection !== undefined) params.set("sortDirection", query.sortDirection)
  const encoded = params.toString()
  return encoded.length === 0 ? "" : `?${encoded}`
}

import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listQueryToSearchParams } from "../../../platform/http/listQueryToSearchParams.js"
import type { UserMetadataListQuery } from "../public/userMetadataListQuerySchema.js"

export function userMetadataListQueryToSearchParams(query: ListQuery | UserMetadataListQuery | undefined): string {
  if (query === undefined) return ""
  const params = new URLSearchParams(listQueryToSearchParams(query).replace(/^\?/, ""))
  if ("keyPrefix" in query && query.keyPrefix !== undefined) params.set("keyPrefix", query.keyPrefix)
  const encoded = params.toString()
  return encoded.length === 0 ? "" : `?${encoded}`
}

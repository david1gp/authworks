import { listQueryToSearchParams } from "../../../platform/http/listQueryToSearchParams.js"
import type { UserListQuery } from "../public/userListQuerySchema.js"

export function userListQueryToSearchParams(query: UserListQuery | undefined): string {
  if (query === undefined) return ""
  const params = new URLSearchParams(listQueryToSearchParams(query).replace(/^\?/, ""))
  if (query.emailVerified !== undefined) params.set("emailVerified", query.emailVerified ? "true" : "false")
  if (query.state !== undefined) params.set("state", query.state)
  const encoded = params.toString()
  return encoded.length === 0 ? "" : `?${encoded}`
}

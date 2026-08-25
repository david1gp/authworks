import { type Result } from "#result"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { AccountEffectiveAccessListResponse } from "../public/accountEffectiveAccessListResponseSchema.js"
import { accountEffectiveAccessListResponseSchema } from "../public/accountEffectiveAccessListResponseSchema.js"

type AccountApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type AccountApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: AccountApiFetch
  readonly token?: Secret | string
}

export function accountApiClientCreate(options: AccountApiClientCreateOptions) {
  return {
    effectiveAccessList(realmId: string, query?: ListQuery): Promise<Result<AccountEffectiveAccessListResponse>> {
      const path = accountEffectiveAccessPathCreate(realmId, query)
      return httpApiClientRequest({
        baseUrl: options.baseUrl,
        fetch: options.fetch,
        init: { method: "GET" },
        op: "accountApiClientEffectiveAccessList",
        path,
        schema: accountEffectiveAccessListResponseSchema,
        token: options.token,
      })
    },
  }
}

function accountEffectiveAccessPathCreate(realmId: string, query: ListQuery | undefined): string {
  const path = `/realms/${encodeURIComponent(realmId)}/me/effective-access`
  if (query === undefined) return path
  const params = new URLSearchParams()
  if (query.pageSize !== undefined) params.set("pageSize", String(query.pageSize))
  if (query.pageToken !== undefined) params.set("pageToken", query.pageToken)
  if (query.sortBy !== undefined) params.set("sortBy", query.sortBy)
  if (query.sortDirection !== undefined) params.set("sortDirection", query.sortDirection)
  const serialized = params.toString()
  return serialized.length === 0 ? path : `${path}?${serialized}`
}

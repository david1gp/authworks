import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import { sessionCsrfResponseSchema } from "../public/sessionCsrfResponseSchema.js"

type SessionCsrfFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

/** Reads the realm-scoped browser CSRF token so cookie-mode mutations can be authorised. */
export async function sessionCsrfTokenGet(options: {
  readonly baseUrl: string
  readonly fetch?: SessionCsrfFetch
  readonly realmId: string
}): Promise<Result<string>> {
  const result = await httpApiClientRequest({
    baseUrl: options.baseUrl,
    fetch: options.fetch,
    init: { credentials: "include", method: "GET" },
    op: "sessionCsrfTokenGet",
    path: `/realms/${encodeURIComponent(options.realmId)}/sessions/csrf`,
    schema: sessionCsrfResponseSchema,
  })
  if (!result.success) return result
  return resultCreate(result.data.csrfToken)
}

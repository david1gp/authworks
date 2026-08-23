import type * as v from "valibot"
import type { Result } from "#result"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import { sessionCsrfTokenGet } from "./sessionCsrfTokenGet.js"
import { sessionBrowserModeHeaderName } from "../public/sessionBrowserModeHeaderName.js"

type SessionBrowserFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type SessionBrowserRequestOptions<T> = {
  readonly baseUrl: string
  readonly fetch?: SessionBrowserFetch
  readonly init: RequestInit
  readonly op: string
  readonly path: string
  readonly realmId: string
  readonly schema: v.GenericSchema<T>
}

export async function sessionBrowserRequest<T>(options: SessionBrowserRequestOptions<T>): Promise<Result<T>> {
  const csrf = await sessionCsrfTokenGet({
    baseUrl: options.baseUrl,
    fetch: options.fetch,
    realmId: options.realmId,
  })
  if (!csrf.success) return csrf

  const headers = new Headers(options.init.headers)
  headers.set("x-csrf-token", csrf.data)
  headers.set(sessionBrowserModeHeaderName, "true")
  return httpApiClientRequest({
    baseUrl: options.baseUrl,
    fetch: options.fetch,
    init: { ...options.init, credentials: "include", headers },
    op: options.op,
    path: options.path,
    schema: options.schema,
  })
}

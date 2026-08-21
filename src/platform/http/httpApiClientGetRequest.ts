import * as v from "valibot"
import type { ResultErr } from "#result"
import { resultErrorCodedCreate } from "../errors/resultErrorCodedCreate.js"
import { Secret } from "../secrets/Secret.js"
import type { HttpGetOptions } from "./HttpGetOptions.js"
import type { HttpGetResult } from "./HttpGetResult.js"
import { httpApiClientErrorResultCreate } from "./httpApiClientErrorResultCreate.js"
import { httpDateFormat } from "./httpDateFormat.js"
import { httpDateParse } from "./httpDateParse.js"
import { httpRequestIdGet } from "./httpRequestIdGet.js"
import { httpUrlResolve } from "./httpUrlResolve.js"

type HttpApiClientGetRequestOptions<T> = HttpGetOptions & {
  readonly baseUrl: string
  readonly fetch?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
  readonly init?: RequestInit
  readonly invalidResponseErrorGet?: (body: unknown) => ResultErr | undefined
  readonly invalidResponseMessage?: string
  readonly op: string
  readonly path: string
  readonly responseErrorMessageGet?: (body: unknown, status: number) => string | undefined
  readonly schema: v.GenericSchema<T>
  readonly token?: Secret | string
}

export async function httpApiClientGetRequest<T>(
  options: HttpApiClientGetRequestOptions<T>,
): Promise<HttpGetResult<T>> {
  const init = { ...options.init, method: options.init?.method ?? "GET" }
  const headers = new Headers(init.headers)
  headers.set("accept", "application/json")
  if (init.body !== undefined && !headers.has("content-type"))
    headers.set(
      "content-type",
      init.body instanceof URLSearchParams ? "application/x-www-form-urlencoded" : "application/json",
    )
  if (options.token !== undefined)
    headers.set("authorization", `Bearer ${options.token instanceof Secret ? options.token.valueGet() : options.token}`)
  if (options.ifModifiedSince instanceof Date) headers.set("if-modified-since", httpDateFormat(options.ifModifiedSince))
  if (typeof options.ifModifiedSince === "string" && options.ifModifiedSince.length > 0)
    headers.set("if-modified-since", options.ifModifiedSince)

  let response: Response
  let body: unknown
  try {
    response = await (options.fetch ?? fetch)(httpUrlResolve(options.baseUrl, options.path), {
      ...init,
      headers,
    })
    if (response.status !== 101 && response.status !== 204 && response.status !== 205 && response.status !== 304)
      body = await response.json().catch(() => undefined)
  } catch (_error) {
    return resultErrorCodedCreate(options.op, "The server could not be reached.", "platform.unreachable")
  }

  const lastModified = httpDateParse(response.headers.get("last-modified") ?? undefined)
  const responseHeaderRequestId = response.headers.get("x-request-id")
  const requestId =
    responseHeaderRequestId === null ? undefined : httpRequestIdGet(responseHeaderRequestId, () => crypto.randomUUID())
  const responseMetadata = {
    ...(lastModified === undefined ? {} : { lastModified }),
    ...(requestId === undefined ? {} : { requestId }),
  }

  if (response.status === 304) return { ...responseMetadata, status: "unchanged", success: true }
  if (!response.ok)
    return httpApiClientErrorResultCreate({
      body,
      op: options.op,
      response,
      responseErrorMessageGet: options.responseErrorMessageGet,
    })

  const parsed = v.safeParse(options.schema, body)
  if (!parsed.success) {
    const customError = options.invalidResponseErrorGet?.(body)
    if (customError !== undefined) return customError
    return resultErrorCodedCreate(
      options.op,
      options.invalidResponseMessage ?? "The server returned an invalid response.",
      "platform.invalid-response",
    )
  }
  return { ...responseMetadata, data: parsed.output, status: "current", success: true }
}

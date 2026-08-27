import * as v from "valibot"
import type { Result, ResultErr } from "#result"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCodedCreate } from "../errors/resultErrorCodedCreate.js"
import { Secret } from "../secrets/Secret.js"
import { httpApiClientErrorResultCreate } from "./httpApiClientErrorResultCreate.js"
import { httpApiInvalidResponseDiagnosticLog } from "./httpApiInvalidResponseDiagnosticLog.js"
import { httpRequestIdGet } from "./httpRequestIdGet.js"
import { httpUrlResolve } from "./httpUrlResolve.js"

type HttpApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type HttpApiClientRequestOptions<T> = {
  readonly baseUrl: string
  readonly fetch?: HttpApiFetch
  readonly init: RequestInit
  readonly invalidResponseErrorGet?: (body: unknown) => ResultErr | undefined
  readonly invalidResponseMessage?: string
  readonly diagnosticLog?: (diagnostic: Record<string, unknown>) => void
  readonly op: string
  readonly path: string
  readonly responseErrorMessageGet?: (body: unknown, status: number) => string | undefined
  readonly schema: v.GenericSchema<T>
  readonly token?: Secret | string
}

export async function httpApiClientRequest<T>(options: HttpApiClientRequestOptions<T>): Promise<Result<T>> {
  const headers = new Headers(options.init.headers)
  headers.set("accept", "application/json")
  if (options.init.body !== undefined && !headers.has("content-type"))
    headers.set(
      "content-type",
      options.init.body instanceof URLSearchParams ? "application/x-www-form-urlencoded" : "application/json",
    )
  if (options.token !== undefined)
    headers.set("authorization", `Bearer ${options.token instanceof Secret ? options.token.valueGet() : options.token}`)
  if (options.init.cache === "no-store") headers.delete("if-modified-since")

  let response: Response
  let body: unknown
  let bodyParseFailed = false
  let requestUrl: URL
  try {
    requestUrl = httpUrlResolve(options.baseUrl, options.path)
    response = await (options.fetch ?? fetch)(requestUrl, {
      ...options.init,
      headers,
    })
    if (response.status !== 101 && response.status !== 204 && response.status !== 205 && response.status !== 304) {
      try {
        body = await response.json()
      } catch (_error) {
        bodyParseFailed = true
      }
    } else if (response.status !== 304) bodyParseFailed = true
  } catch (_error) {
    return resultErrorCodedCreate(options.op, "The server could not be reached.", "platform.unreachable")
  }

  const requestId = httpRequestIdGet(response.headers.get("x-request-id") ?? undefined, () => crypto.randomUUID())
  if (!response.ok) {
    const diagnostic = {
      bodyParseFailed,
      reason: response.status === 304 ? ("unexpected-304" as const) : undefined,
      requestId,
      url: requestUrl,
    }
    return httpApiClientErrorResultCreate({
      body,
      diagnostic: { ...diagnostic, log: options.diagnosticLog },
      op: options.op,
      response,
      responseErrorMessageGet: options.responseErrorMessageGet,
    })
  }

  const parsed = v.safeParse(options.schema, body)
  if (!parsed.success) {
    httpApiInvalidResponseDiagnosticLog({
      issues: bodyParseFailed ? undefined : parsed.issues,
      log: options.diagnosticLog,
      op: options.op,
      reason: bodyParseFailed ? "invalid-json" : "invalid-schema",
      requestId,
      status: response.status,
      url: requestUrl,
    })
    const customError = options.invalidResponseErrorGet?.(body)
    if (customError !== undefined) return customError
    return resultErrorCodedCreate(
      options.op,
      options.invalidResponseMessage ?? "The server returned an invalid response.",
      "platform.invalid-response",
    )
  }
  return resultCreate(parsed.output)
}

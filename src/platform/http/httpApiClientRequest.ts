import * as v from "valibot"
import type { Result, ResultErr } from "#result"
import { errorCatalogHttpMappingGet } from "../errors/errorCatalogHttpMappingGet.js"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCodedCreate } from "../errors/resultErrorCodedCreate.js"
import { Secret } from "../secrets/Secret.js"
import { httpErrorResponseSchema } from "./httpErrorResponseSchema.js"
import { httpRequestIdGet } from "./httpRequestIdGet.js"
import { httpUrlResolve } from "./httpUrlResolve.js"

type HttpApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type HttpApiClientRequestOptions<T> = {
  readonly baseUrl: string
  readonly fetch?: HttpApiFetch
  readonly init: RequestInit
  readonly invalidResponseErrorGet?: (body: unknown) => ResultErr | undefined
  readonly invalidResponseMessage?: string
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

  let response: Response
  let body: unknown
  try {
    response = await (options.fetch ?? fetch)(httpUrlResolve(options.baseUrl, options.path), {
      ...options.init,
      headers,
    })
    body = await response.json().catch(() => undefined)
  } catch (_error) {
    return resultErrorCodedCreate(options.op, "The server could not be reached.", "platform.unreachable")
  }

  if (!response.ok) {
    const parsedError = v.safeParse(httpErrorResponseSchema, body)
    if (parsedError.success) {
      const responseHeaderRequestId = response.headers.get("x-request-id") ?? undefined
      const requestId = httpRequestIdGet(responseHeaderRequestId ?? parsedError.output.error.requestId, () =>
        crypto.randomUUID(),
      )
      const retryable =
        parsedError.output.error.retryable ?? errorCatalogHttpMappingGet(parsedError.output.error.code).retryable
      const retryAfter = response.headers.get("retry-after")
      const details = {
        ...(parsedError.output.error.details ?? {}),
        requestId,
        retryable,
        status: response.status,
        ...(retryAfter === null ? {} : { retryAfter }),
      }
      const result = resultErrorCodedCreate(
        options.op,
        parsedError.output.error.message,
        parsedError.output.error.code,
        details,
      )
      result.statusCode = response.status
      return result
    }
    const customMessage = options.responseErrorMessageGet?.(body, response.status)
    if (customMessage !== undefined) {
      const result = resultErrorCodedCreate(options.op, customMessage, "platform.http", { status: response.status })
      result.statusCode = response.status
      return result
    }
    const result = resultErrorCodedCreate(options.op, `The server returned HTTP ${response.status}.`, "platform.http", {
      status: response.status,
    })
    result.statusCode = response.status
    return result
  }

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
  return resultCreate(parsed.output)
}

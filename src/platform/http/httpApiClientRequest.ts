import * as v from "valibot"
import type { Result, ResultErr } from "#result"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCreate } from "../errors/resultErrorCreate.js"
import { httpErrorResponseSchema } from "./httpErrorResponseSchema.js"
import { Secret } from "../secrets/Secret.js"

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
    response = await (options.fetch ?? fetch)(new URL(options.path, options.baseUrl), {
      ...options.init,
      headers,
    })
    body = await response.json().catch(() => undefined)
  } catch (_error) {
    return resultErrorCreate(options.op, "The server could not be reached.")
  }

  if (!response.ok) {
    const customMessage = options.responseErrorMessageGet?.(body, response.status)
    if (customMessage !== undefined) return resultErrorCreate(options.op, customMessage)
    const parsedError = v.safeParse(httpErrorResponseSchema, body)
    if (!parsedError.success) return resultErrorCreate(options.op, `The server returned HTTP ${response.status}.`)
    return resultErrorCreate(options.op, `${parsedError.output.error.code}: ${parsedError.output.error.message}`)
  }

  const parsed = v.safeParse(options.schema, body)
  if (!parsed.success) {
    const customError = options.invalidResponseErrorGet?.(body)
    if (customError !== undefined) return customError
    return resultErrorCreate(options.op, options.invalidResponseMessage ?? "The server returned an invalid response.")
  }
  return resultCreate(parsed.output)
}

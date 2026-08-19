import * as v from "valibot"
import type { ResultErr } from "#result"
import { errorCatalogHttpMappingGet } from "../errors/errorCatalogHttpMappingGet.js"
import { resultErrorCodedCreate } from "../errors/resultErrorCodedCreate.js"
import { httpErrorResponseSchema } from "./httpErrorResponseSchema.js"
import { httpRequestIdGet } from "./httpRequestIdGet.js"

type HttpApiClientErrorResultCreateOptions = {
  readonly body: unknown
  readonly op: string
  readonly response: Response
  readonly responseErrorMessageGet?: (body: unknown, status: number) => string | undefined
}

export function httpApiClientErrorResultCreate(options: HttpApiClientErrorResultCreateOptions): ResultErr {
  const parsedError = v.safeParse(httpErrorResponseSchema, options.body)
  if (parsedError.success) {
    const responseHeaderRequestId = options.response.headers.get("x-request-id") ?? undefined
    const requestId = httpRequestIdGet(responseHeaderRequestId ?? parsedError.output.error.requestId, () =>
      crypto.randomUUID(),
    )
    const retryable =
      parsedError.output.error.retryable ?? errorCatalogHttpMappingGet(parsedError.output.error.code).retryable
    const retryAfter = options.response.headers.get("retry-after")
    const details = {
      ...(parsedError.output.error.details ?? {}),
      requestId,
      retryable,
      status: options.response.status,
      ...(retryAfter === null ? {} : { retryAfter }),
    }
    const result = resultErrorCodedCreate(
      options.op,
      parsedError.output.error.message,
      parsedError.output.error.code,
      details,
    )
    result.statusCode = options.response.status
    return result
  }

  const customMessage = options.responseErrorMessageGet?.(options.body, options.response.status)
  if (customMessage !== undefined) {
    const result = resultErrorCodedCreate(options.op, customMessage, "platform.http", {
      status: options.response.status,
    })
    result.statusCode = options.response.status
    return result
  }
  const result = resultErrorCodedCreate(
    options.op,
    `The server returned HTTP ${options.response.status}.`,
    "platform.http",
    { status: options.response.status },
  )
  result.statusCode = options.response.status
  return result
}

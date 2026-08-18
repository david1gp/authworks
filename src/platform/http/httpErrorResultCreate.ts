import { errorCatalogGet } from "../errors/errorCatalogGet.js"
import { resultErrorDetailsParse } from "../errors/resultErrorDetailsParse.js"
import { httpErrorResponseCreate } from "./httpErrorResponseCreate.js"
import type { HttpErrorResponse } from "./httpErrorResponseSchema.js"

export function httpErrorResultCreate(input: {
  result: {
    success: false
    op: string
    errorMessage: string
    code?: string
    errorData?: string | null
    statusCode?: number
  }
  requestId: string
}): { body: HttpErrorResponse; status: number; retryable: boolean } {
  const catalogEntry = input.result.code === undefined ? undefined : errorCatalogGet(input.result.code)
  const code = catalogEntry === undefined ? "platform.internal" : (input.result.code ?? "platform.internal")
  const status = input.result.statusCode ?? catalogEntry?.httpStatus ?? 500
  const retryable = catalogEntry?.retryable ?? false
  const details = resultErrorDetailsParse(input.result)
  const body = httpErrorResponseCreate({
    code,
    details,
    message: input.result.errorMessage,
    op: input.result.op,
    requestId: input.requestId,
    retryable,
    status,
  })
  return { body, retryable, status }
}

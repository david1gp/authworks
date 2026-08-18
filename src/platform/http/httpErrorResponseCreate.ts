import * as v from "valibot"
import { resultErrorCodeSchema } from "../errors/resultErrorCodeSchema.js"
import type { HttpErrorResponse } from "./httpErrorResponseSchema.js"

const legacyCodeMap: Record<string, string> = {
  bad_request: "platform.invalid",
  not_found: "platform.not-found",
  unauthorized: "platform.unauthorized",
  forbidden: "platform.forbidden",
  conflict: "platform.conflict",
  rate_limited: "platform.rate-limited",
  service_unavailable: "platform.unavailable",
  internal_server_error: "platform.internal",
}

export function httpErrorResponseCreate(code: string, message: string): HttpErrorResponse
export function httpErrorResponseCreate(input: {
  readonly code: string
  readonly message: string
  readonly op?: string
  readonly details?: Readonly<Record<string, unknown>>
  readonly status?: number
  readonly requestId?: string
  readonly retryable?: boolean
}): HttpErrorResponse
export function httpErrorResponseCreate(
  codeOrInput:
    | string
    | {
        readonly code: string
        readonly message: string
        readonly op?: string
        readonly details?: Readonly<Record<string, unknown>>
        readonly status?: number
        readonly requestId?: string
        readonly retryable?: boolean
      },
  legacyMessage?: string,
): HttpErrorResponse {
  const input = typeof codeOrInput === "string" ? undefined : codeOrInput
  const attemptedCode = typeof codeOrInput === "string" ? codeOrInput : codeOrInput.code
  const mappedCode = legacyCodeMap[attemptedCode] ?? attemptedCode
  const parsedCode = v.safeParse(resultErrorCodeSchema, mappedCode)
  const code = parsedCode.success ? parsedCode.output : "platform.invalid-error-code"
  const message = input?.message ?? legacyMessage ?? ""
  const error: HttpErrorResponse["error"] = { code, message }

  if (input?.op !== undefined) error.op = input.op
  if (input?.details !== undefined) error.details = input.details
  if (input?.status !== undefined) error.status = input.status
  if (input?.requestId !== undefined) error.requestId = input.requestId
  if (input?.retryable !== undefined) error.retryable = input.retryable
  return { error }
}

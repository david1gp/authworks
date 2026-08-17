import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { httpErrorResponseSchema } from "../../../platform/http/httpErrorResponseSchema.js"
import type { EmailOtpStartRequest } from "../public/emailOtpStartRequestSchema.js"
import { emailOtpStartRequestSchema } from "../public/emailOtpStartRequestSchema.js"
import type { EmailOtpStartResponse } from "../public/emailOtpStartResponseSchema.js"
import { emailOtpStartResponseSchema } from "../public/emailOtpStartResponseSchema.js"
import type { EmailOtpVerifyRequest } from "../public/emailOtpVerifyRequestSchema.js"
import { emailOtpVerifyRequestSchema } from "../public/emailOtpVerifyRequestSchema.js"
import type { EmailOtpVerifyResponse } from "../public/emailOtpVerifyResponseSchema.js"
import { emailOtpVerifyResponseSchema } from "../public/emailOtpVerifyResponseSchema.js"

type EmailOtpApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type EmailOtpApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: EmailOtpApiFetch
}

export function emailOtpApiClientCreate(options: EmailOtpApiClientCreateOptions) {
  const request = async <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> => {
    const op = "emailOtpApiClientRequest"
    const headers = new Headers(init.headers)
    headers.set("accept", "application/json")
    if (init.body !== undefined) headers.set("content-type", "application/json")
    try {
      const response = await (options.fetch ?? fetch)(new URL(path, options.baseUrl), { ...init, headers })
      const body = await response.json().catch(() => undefined)
      if (!response.ok) {
        const parsedError = v.safeParse(httpErrorResponseSchema, body)
        if (!parsedError.success) return resultErrorCreate(op, `The server returned HTTP ${response.status}.`)
        return resultErrorCreate(op, `${parsedError.output.error.code}: ${parsedError.output.error.message}`)
      }
      const parsed = v.safeParse(schema, body)
      if (!parsed.success) return resultErrorCreate(op, "The server returned an invalid response.")
      return resultCreate(parsed.output)
    } catch (_error) {
      return resultErrorCreate(op, "The server could not be reached.")
    }
  }

  const parsedRequest = <T>(schema: v.GenericSchema<T>, input: unknown, errorMessage: string) => {
    const parsed = v.safeParse(schema, input)
    if (!parsed.success) return resultErrorCreate("emailOtpApiClientCreate", errorMessage)
    return resultCreate(parsed.output)
  }

  return {
    emailOtpStart(instanceId: string, input: EmailOtpStartRequest): Promise<Result<EmailOtpStartResponse>> {
      const parsed = parsedRequest(emailOtpStartRequestSchema, input, "The email OTP request is invalid.")
      if (!parsed.success) return Promise.resolve(parsed)
      return request(
        `/instances/${encodeURIComponent(instanceId)}/email-otp/start`,
        { body: JSON.stringify(parsed.data), method: "POST" },
        emailOtpStartResponseSchema,
      )
    },
    emailOtpVerify(instanceId: string, input: EmailOtpVerifyRequest): Promise<Result<EmailOtpVerifyResponse>> {
      const parsed = parsedRequest(emailOtpVerifyRequestSchema, input, "The email OTP code is invalid.")
      if (!parsed.success) return Promise.resolve(parsed)
      return request(
        `/instances/${encodeURIComponent(instanceId)}/email-otp/verify`,
        { body: JSON.stringify(parsed.data), method: "POST" },
        emailOtpVerifyResponseSchema,
      )
    },
  }
}

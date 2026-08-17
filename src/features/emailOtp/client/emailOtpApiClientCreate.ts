import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
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
  const request = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "emailOtpApiClientRequest",
      path,
      schema,
    })

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

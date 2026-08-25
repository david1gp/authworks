import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import { sessionBrowserRequest } from "../../sessions/client/sessionBrowserRequest.js"
import type { WhatsappOtpAvailabilityResponse } from "../public/whatsappOtpAvailabilityResponseSchema.js"
import { whatsappOtpAvailabilityResponseSchema } from "../public/whatsappOtpAvailabilityResponseSchema.js"
import type { WhatsappOtpPhoneChangeResendRequest } from "../public/whatsappOtpPhoneChangeResendRequestSchema.js"
import { whatsappOtpPhoneChangeResendRequestSchema } from "../public/whatsappOtpPhoneChangeResendRequestSchema.js"
import type { WhatsappOtpPhoneChangeResendResponse } from "../public/whatsappOtpPhoneChangeResendResponseSchema.js"
import { whatsappOtpPhoneChangeResendResponseSchema } from "../public/whatsappOtpPhoneChangeResendResponseSchema.js"
import type { WhatsappOtpPhoneChangeStartRequest } from "../public/whatsappOtpPhoneChangeStartRequestSchema.js"
import { whatsappOtpPhoneChangeStartRequestSchema } from "../public/whatsappOtpPhoneChangeStartRequestSchema.js"
import type { WhatsappOtpPhoneChangeStartResponse } from "../public/whatsappOtpPhoneChangeStartResponseSchema.js"
import { whatsappOtpPhoneChangeStartResponseSchema } from "../public/whatsappOtpPhoneChangeStartResponseSchema.js"
import type { WhatsappOtpPhoneChangeVerifyRequest } from "../public/whatsappOtpPhoneChangeVerifyRequestSchema.js"
import { whatsappOtpPhoneChangeVerifyRequestSchema } from "../public/whatsappOtpPhoneChangeVerifyRequestSchema.js"
import type { WhatsappOtpPhoneChangeVerifyResponse } from "../public/whatsappOtpPhoneChangeVerifyResponseSchema.js"
import { whatsappOtpPhoneChangeVerifyResponseSchema } from "../public/whatsappOtpPhoneChangeVerifyResponseSchema.js"
import type { WhatsappOtpResendRequest } from "../public/whatsappOtpResendRequestSchema.js"
import { whatsappOtpResendRequestSchema } from "../public/whatsappOtpResendRequestSchema.js"
import type { WhatsappOtpResendResponse } from "../public/whatsappOtpResendResponseSchema.js"
import { whatsappOtpResendResponseSchema } from "../public/whatsappOtpResendResponseSchema.js"
import type { WhatsappOtpStartRequest } from "../public/whatsappOtpStartRequestSchema.js"
import { whatsappOtpStartRequestSchema } from "../public/whatsappOtpStartRequestSchema.js"
import type { WhatsappOtpStartResponse } from "../public/whatsappOtpStartResponseSchema.js"
import { whatsappOtpStartResponseSchema } from "../public/whatsappOtpStartResponseSchema.js"
import type { WhatsappOtpVerifyRequest } from "../public/whatsappOtpVerifyRequestSchema.js"
import { whatsappOtpVerifyRequestSchema } from "../public/whatsappOtpVerifyRequestSchema.js"
import type { WhatsappOtpVerifyResponse } from "../public/whatsappOtpVerifyResponseSchema.js"
import { whatsappOtpVerifyResponseSchema } from "../public/whatsappOtpVerifyResponseSchema.js"

type WhatsappOtpApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type WhatsappOtpApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: WhatsappOtpApiFetch
}

export function whatsappOtpApiClientCreate(options: WhatsappOtpApiClientCreateOptions) {
  const request = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "whatsappOtpApiClientRequest",
      path,
      schema,
    })

  const parsedRequest = <T>(schema: v.GenericSchema<T>, input: unknown, errorMessage: string) => {
    const parsed = v.safeParse(schema, input)
    if (!parsed.success) return resultErrorCreate("whatsappOtpApiClientCreate", errorMessage, "whatsapp-otp.invalid")
    return resultCreate(parsed.output)
  }

  const browserMutation = <T>(
    realmId: string,
    path: string,
    input: unknown,
    requestSchema: v.GenericSchema<unknown>,
    schema: v.GenericSchema<T>,
    errorMessage: string,
    op: string,
  ): Promise<Result<T>> => {
    const parsed = v.safeParse(requestSchema, input)
    if (!parsed.success)
      return Promise.resolve(resultErrorCreate("whatsappOtpApiClientCreate", errorMessage, "whatsapp-otp.invalid"))
    return sessionBrowserRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init: { body: JSON.stringify(parsed.output), method: "POST" },
      op,
      path,
      realmId,
      schema,
    })
  }

  return {
    whatsappOtpAvailabilityGet(
      realmId: string,
      organizationId?: string,
    ): Promise<Result<WhatsappOtpAvailabilityResponse>> {
      const query = organizationId === undefined ? "" : `?organizationId=${encodeURIComponent(organizationId)}`
      return request(
        `/realms/${encodeURIComponent(realmId)}/whatsapp-otp/availability${query}`,
        { method: "GET" },
        whatsappOtpAvailabilityResponseSchema,
      )
    },
    whatsappOtpStart(realmId: string, input: WhatsappOtpStartRequest): Promise<Result<WhatsappOtpStartResponse>> {
      const parsed = parsedRequest(whatsappOtpStartRequestSchema, input, "The WhatsApp OTP request is invalid.")
      if (!parsed.success) return Promise.resolve(parsed)
      return request(
        `/realms/${encodeURIComponent(realmId)}/whatsapp-otp/start`,
        { body: JSON.stringify(parsed.data), method: "POST" },
        whatsappOtpStartResponseSchema,
      )
    },
    whatsappOtpResend(realmId: string, input: WhatsappOtpResendRequest): Promise<Result<WhatsappOtpResendResponse>> {
      const parsed = parsedRequest(whatsappOtpResendRequestSchema, input, "The WhatsApp OTP request is invalid.")
      if (!parsed.success) return Promise.resolve(parsed)
      return request(
        `/realms/${encodeURIComponent(realmId)}/whatsapp-otp/resend`,
        { body: JSON.stringify(parsed.data), method: "POST" },
        whatsappOtpResendResponseSchema,
      )
    },
    whatsappOtpVerify(realmId: string, input: WhatsappOtpVerifyRequest): Promise<Result<WhatsappOtpVerifyResponse>> {
      const parsed = parsedRequest(whatsappOtpVerifyRequestSchema, input, "The WhatsApp OTP code is invalid.")
      if (!parsed.success) return Promise.resolve(parsed)
      return request(
        `/realms/${encodeURIComponent(realmId)}/whatsapp-otp/verify`,
        { body: JSON.stringify(parsed.data), method: "POST" },
        whatsappOtpVerifyResponseSchema,
      )
    },
    whatsappOtpPhoneChangeStart(
      realmId: string,
      input: WhatsappOtpPhoneChangeStartRequest,
    ): Promise<Result<WhatsappOtpPhoneChangeStartResponse>> {
      return browserMutation(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/me/phone-change/start`,
        input,
        whatsappOtpPhoneChangeStartRequestSchema,
        whatsappOtpPhoneChangeStartResponseSchema,
        "The account phone-change request is invalid.",
        "whatsappOtpPhoneChangeStart",
      )
    },
    whatsappOtpPhoneChangeResend(
      realmId: string,
      input: WhatsappOtpPhoneChangeResendRequest,
    ): Promise<Result<WhatsappOtpPhoneChangeResendResponse>> {
      return browserMutation(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/me/phone-change/resend`,
        input,
        whatsappOtpPhoneChangeResendRequestSchema,
        whatsappOtpPhoneChangeResendResponseSchema,
        "The account phone-change request is invalid.",
        "whatsappOtpPhoneChangeResend",
      )
    },
    whatsappOtpPhoneChangeVerify(
      realmId: string,
      input: WhatsappOtpPhoneChangeVerifyRequest,
    ): Promise<Result<WhatsappOtpPhoneChangeVerifyResponse>> {
      return browserMutation(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/me/phone-change/verify`,
        input,
        whatsappOtpPhoneChangeVerifyRequestSchema,
        whatsappOtpPhoneChangeVerifyResponseSchema,
        "The account phone-change code is invalid.",
        "whatsappOtpPhoneChangeVerify",
      )
    },
  }
}

import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import type { MfaChallengeCompleteRequest } from "../public/mfaChallengeCompleteRequestSchema.js"
import { mfaChallengeCompleteRequestSchema } from "../public/mfaChallengeCompleteRequestSchema.js"
import type { MfaChallengeResponse } from "../public/mfaChallengeResponseSchema.js"
import { mfaChallengeResponseSchema } from "../public/mfaChallengeResponseSchema.js"
import type { MfaLoginResponse } from "../public/mfaLoginResponseSchema.js"
import { mfaLoginResponseSchema } from "../public/mfaLoginResponseSchema.js"
import type { MfaPolicyResponse } from "../public/mfaPolicyResponseSchema.js"
import { mfaPolicyResponseSchema } from "../public/mfaPolicyResponseSchema.js"
import type { MfaPolicySetRequest } from "../public/mfaPolicySetRequestSchema.js"
import { mfaPolicySetRequestSchema } from "../public/mfaPolicySetRequestSchema.js"
import type { MfaRecoveryCodesResponse } from "../public/mfaRecoveryCodesResponseSchema.js"
import { mfaRecoveryCodesResponseSchema } from "../public/mfaRecoveryCodesResponseSchema.js"
import type { MfaRecoveryCodeVerifyResponse } from "../public/mfaRecoveryCodeVerifyResponseSchema.js"
import { mfaRecoveryCodeVerifyResponseSchema } from "../public/mfaRecoveryCodeVerifyResponseSchema.js"
import type { MfaTotpEnrollmentConfirmRequest } from "../public/mfaTotpEnrollmentConfirmRequestSchema.js"
import { mfaTotpEnrollmentConfirmRequestSchema } from "../public/mfaTotpEnrollmentConfirmRequestSchema.js"
import type { MfaTotpEnrollmentConfirmResponse } from "../public/mfaTotpEnrollmentConfirmResponseSchema.js"
import { mfaTotpEnrollmentConfirmResponseSchema } from "../public/mfaTotpEnrollmentConfirmResponseSchema.js"
import type { MfaTotpEnrollmentRemoveResponse } from "../public/mfaTotpEnrollmentRemoveResponseSchema.js"
import { mfaTotpEnrollmentRemoveResponseSchema } from "../public/mfaTotpEnrollmentRemoveResponseSchema.js"
import type { MfaTotpEnrollmentStartRequest } from "../public/mfaTotpEnrollmentStartRequestSchema.js"
import { mfaTotpEnrollmentStartRequestSchema } from "../public/mfaTotpEnrollmentStartRequestSchema.js"
import type { MfaTotpEnrollmentStartResponse } from "../public/mfaTotpEnrollmentStartResponseSchema.js"
import { mfaTotpEnrollmentStartResponseSchema } from "../public/mfaTotpEnrollmentStartResponseSchema.js"
import type { MfaTotpVerifyResponse } from "../public/mfaTotpVerifyResponseSchema.js"
import { mfaTotpVerifyResponseSchema } from "../public/mfaTotpVerifyResponseSchema.js"

type MfaApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type MfaApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: MfaApiFetch
  readonly token?: Secret | string
  readonly systemToken?: Secret | string
}

export function mfaApiClientCreate(options: MfaApiClientCreateOptions) {
  const request = <T>(
    path: string,
    init: RequestInit,
    schema: v.GenericSchema<T>,
    token = options.token,
  ): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "mfaApiClientRequest",
      path,
      schema,
      token,
    })
  const parsed = <T>(schema: v.GenericSchema<T>, input: unknown, message: string): Result<T> => {
    const value = v.safeParse(schema, input)
    return value.success ? resultCreate(value.output) : resultErrorCreate("mfaApiClientCreate", message)
  }
  const json = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "POST" })

  return {
    mfaPolicyGet(realmId: string): Promise<Result<MfaPolicyResponse>> {
      return request(
        `/realms/${encodeURIComponent(realmId)}/mfa-policy`,
        { method: "GET" },
        mfaPolicyResponseSchema,
        options.systemToken,
      )
    },
    mfaPolicySet(realmId: string, input: MfaPolicySetRequest): Promise<Result<MfaPolicyResponse>> {
      const checked = parsed(mfaPolicySetRequestSchema, input, "The MFA policy is invalid.")
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/mfa-policy`,
        { ...json(checked.data), method: "PATCH" },
        mfaPolicyResponseSchema,
        options.systemToken,
      )
    },
    mfaTotpEnrollmentStart(
      realmId: string,
      input: MfaTotpEnrollmentStartRequest = {},
    ): Promise<Result<MfaTotpEnrollmentStartResponse>> {
      const checked = parsed(mfaTotpEnrollmentStartRequestSchema, input, "The TOTP enrollment request is invalid.")
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/realms/${encodeURIComponent(realmId)}/mfa/totp/enroll`,
        json(checked.data),
        mfaTotpEnrollmentStartResponseSchema,
      )
    },
    mfaTotpEnrollmentConfirm(
      realmId: string,
      input: MfaTotpEnrollmentConfirmRequest,
    ): Promise<Result<MfaTotpEnrollmentConfirmResponse>> {
      const checked = parsed(mfaTotpEnrollmentConfirmRequestSchema, input, "The TOTP confirmation request is invalid.")
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/realms/${encodeURIComponent(realmId)}/mfa/totp/confirm`,
        json(checked.data),
        mfaTotpEnrollmentConfirmResponseSchema,
      )
    },
    mfaTotpEnrollmentRemove(realmId: string): Promise<Result<MfaTotpEnrollmentRemoveResponse>> {
      return request(
        `/realms/${encodeURIComponent(realmId)}/mfa/totp`,
        { method: "DELETE" },
        mfaTotpEnrollmentRemoveResponseSchema,
      )
    },
    mfaTotpVerify(realmId: string, code: string): Promise<Result<MfaTotpVerifyResponse>> {
      return request(
        `/realms/${encodeURIComponent(realmId)}/mfa/totp/verify`,
        json({ code }),
        mfaTotpVerifyResponseSchema,
      )
    },
    mfaRecoveryCodesGenerate(realmId: string): Promise<Result<MfaRecoveryCodesResponse>> {
      return request(
        `/realms/${encodeURIComponent(realmId)}/mfa/recovery-codes`,
        json({}),
        mfaRecoveryCodesResponseSchema,
      )
    },
    mfaRecoveryCodeVerify(realmId: string, code: string): Promise<Result<MfaRecoveryCodeVerifyResponse>> {
      return request(
        `/realms/${encodeURIComponent(realmId)}/mfa/recovery-codes/verify`,
        json({ code }),
        mfaRecoveryCodeVerifyResponseSchema,
      )
    },
    mfaStepUpStart(realmId: string): Promise<Result<MfaChallengeResponse>> {
      return request(`/realms/${encodeURIComponent(realmId)}/mfa/step-up/start`, json({}), mfaChallengeResponseSchema)
    },
    mfaStepUpComplete(realmId: string, input: MfaChallengeCompleteRequest): Promise<Result<MfaLoginResponse>> {
      const checked = parsed(mfaChallengeCompleteRequestSchema, input, "The MFA code is invalid.")
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/realms/${encodeURIComponent(realmId)}/mfa/step-up/complete`,
        json(checked.data),
        mfaLoginResponseSchema,
      )
    },
    mfaChallengeComplete(realmId: string, input: MfaChallengeCompleteRequest): Promise<Result<MfaLoginResponse>> {
      const checked = parsed(mfaChallengeCompleteRequestSchema, input, "The MFA code is invalid.")
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/realms/${encodeURIComponent(realmId)}/mfa/challenge/complete`,
        json(checked.data),
        mfaLoginResponseSchema,
      )
    },
  }
}

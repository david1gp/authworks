import type * as v from "valibot"
import type { Result } from "#result"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import { emailOtpStartResponseSchema } from "../../emailOtp/public/emailOtpStartResponseSchema.js"
import { emailOtpVerifyResponseSchema } from "../../emailOtp/public/emailOtpVerifyResponseSchema.js"
import { externalIdentityStartResponseSchema } from "../../externalIdentities/public/externalIdentityStartResponseSchema.js"
import { mfaLoginResponseSchema } from "../../mfa/public/mfaLoginResponseSchema.js"
import { mfaTotpEnrollmentConfirmResponseSchema } from "../../mfa/public/mfaTotpEnrollmentConfirmResponseSchema.js"
import { mfaTotpEnrollmentStartResponseSchema } from "../../mfa/public/mfaTotpEnrollmentStartResponseSchema.js"
import { organizationApiClientCreate } from "../../organizations/client/organizationApiClientCreate.js"
import type { PasskeyAuthenticationCompleteRequest } from "../../passkeys/public/passkeyAuthenticationCompleteRequestSchema.js"
import { passkeyAuthenticationCompleteResponseSchema } from "../../passkeys/public/passkeyAuthenticationCompleteResponseSchema.js"
import { passkeyAuthenticationStartResponseSchema } from "../../passkeys/public/passkeyAuthenticationStartResponseSchema.js"
import { passwordEmailVerificationResponseSchema } from "../../passwords/public/passwordEmailVerificationResponseSchema.js"
import { passwordLoginResponseSchema } from "../../passwords/public/passwordLoginResponseSchema.js"
import { passwordMeChangeResponseSchema } from "../../passwords/public/passwordMeChangeResponseSchema.js"
import { passwordRecoveryCompleteResponseSchema } from "../../passwords/public/passwordRecoveryCompleteResponseSchema.js"
import { passwordRecoveryResponseSchema } from "../../passwords/public/passwordRecoveryResponseSchema.js"
import type { PasswordRegistrationRequest } from "../../passwords/public/passwordRegistrationRequestSchema.js"
import { passwordRegistrationResponseSchema } from "../../passwords/public/passwordRegistrationResponseSchema.js"
import { sessionApiClientCreate } from "../../sessions/client/sessionApiClientCreate.js"
import { sessionBrowserRequest } from "../../sessions/client/sessionBrowserRequest.js"
import { sessionBrowserModeHeaderName } from "../../sessions/public/sessionBrowserModeHeaderName.js"
import { sessionRevocationResponseSchema } from "../../sessions/public/sessionRevocationResponseSchema.js"
import { whatsappOtpApiClientCreate } from "../../whatsappOtp/client/whatsappOtpApiClientCreate.js"
import { whatsappOtpResendResponseSchema } from "../../whatsappOtp/public/whatsappOtpResendResponseSchema.js"
import { whatsappOtpStartResponseSchema } from "../../whatsappOtp/public/whatsappOtpStartResponseSchema.js"
import { whatsappOtpVerifyResponseSchema } from "../../whatsappOtp/public/whatsappOtpVerifyResponseSchema.js"

type LoginFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

const realmPath = (realmId: string) => `/realms/${encodeURIComponent(realmId)}`

/**
 * Browser API surface for the hosted login. Primary authentication runs unauthenticated in cookie
 * mode; anything performed with an established session cookie goes through the CSRF exchange.
 */
export function loginApiCreate(options: { readonly baseUrl: string; readonly fetch?: LoginFetch }) {
  const browserFetch: LoginFetch = (input, init) => (options.fetch ?? fetch)(input, { ...init, credentials: "include" })
  const organizations = organizationApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })
  const sessions = sessionApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })
  const whatsappOtp = whatsappOtpApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })

  const post = <T>(path: string, body: unknown, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init: {
        body: JSON.stringify(body),
        credentials: "include",
        headers: { "content-type": "application/json", [sessionBrowserModeHeaderName]: "true" },
        method: "POST",
      },
      op: "loginBrowserRequest",
      path,
      schema,
    })
  const guarded = <T>(realmId: string, path: string, body: unknown, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    sessionBrowserRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init: { body: JSON.stringify(body), headers: { "content-type": "application/json" }, method: "POST" },
      op: "loginBrowserMutation",
      path,
      realmId,
      schema,
    })

  return {
    discover: (domain: string) => organizations.organizationTenantDomainDiscover(domain),
    emailOtpStart: (realmId: string, email: string, organizationId?: string) =>
      post(
        `${realmPath(realmId)}/email-otp/start`,
        { email, ...(organizationId === undefined ? {} : { organizationId }) },
        emailOtpStartResponseSchema,
      ),
    emailOtpVerify: (realmId: string, challengeId: string, code: string, organizationId?: string) =>
      post(
        `${realmPath(realmId)}/email-otp/verify`,
        { challengeId, code, ...(organizationId === undefined ? {} : { organizationId }) },
        emailOtpVerifyResponseSchema,
      ),
    logout: (realmId: string) =>
      guarded(realmId, `${realmPath(realmId)}/sessions/logout`, {}, sessionRevocationResponseSchema),
    mfaChallengeComplete: (realmId: string, token: string, code: string) =>
      post(`${realmPath(realmId)}/mfa/challenge/complete`, { code, token }, mfaLoginResponseSchema),
    mfaTotpEnrollConfirm: (realmId: string, enrollmentId: string, code: string) =>
      guarded(
        realmId,
        `${realmPath(realmId)}/mfa/totp/confirm`,
        { code, enrollmentId },
        mfaTotpEnrollmentConfirmResponseSchema,
      ),
    mfaTotpEnrollStart: (realmId: string) =>
      guarded(realmId, `${realmPath(realmId)}/mfa/totp/enroll`, {}, mfaTotpEnrollmentStartResponseSchema),
    passkeyAuthenticationComplete: (realmId: string, input: PasskeyAuthenticationCompleteRequest) =>
      post(
        `${realmPath(realmId)}/passkeys/authentication/complete`,
        input,
        passkeyAuthenticationCompleteResponseSchema,
      ),
    passkeyAuthenticationStart: (realmId: string, organizationId?: string) =>
      post(
        `${realmPath(realmId)}/passkeys/authentication/start`,
        organizationId === undefined ? {} : { organizationId },
        passkeyAuthenticationStartResponseSchema,
      ),
    passwordLogin: (realmId: string, identifier: string, password: string, organizationId?: string) =>
      post(
        `${realmPath(realmId)}/password/login`,
        { identifier, password, ...(organizationId === undefined ? {} : { organizationId }) },
        passwordLoginResponseSchema,
      ),
    passwordMeChange: (realmId: string, currentPassword: string, newPassword: string) =>
      guarded(
        realmId,
        `${realmPath(realmId)}/me/password`,
        { currentPassword, newPassword },
        passwordMeChangeResponseSchema,
      ),
    providerStart: (
      realmId: string,
      providerId: string,
      input: { readonly interaction?: string; readonly organizationId?: string },
    ) =>
      post(
        `${realmPath(realmId)}/external-identity/${encodeURIComponent(providerId)}/start`,
        input,
        externalIdentityStartResponseSchema,
      ),
    recentList: (realmId: string) => sessions.sessionRecentList(realmId),
    recentResume: (realmId: string, sessionId: string, organizationId?: string) =>
      sessions.sessionRecentResume(realmId, sessionId, organizationId),
    recoveryComplete: (realmId: string, token: string, newPassword: string) =>
      post(
        `${realmPath(realmId)}/password/recovery/complete`,
        { newPassword, token },
        passwordRecoveryCompleteResponseSchema,
      ),
    recoveryRequest: (realmId: string, email: string, organizationId?: string) =>
      post(
        `${realmPath(realmId)}/password/recovery/request`,
        { email, ...(organizationId === undefined ? {} : { organizationId }) },
        passwordRecoveryResponseSchema,
      ),
    register: (realmId: string, input: PasswordRegistrationRequest) =>
      post(`${realmPath(realmId)}/password/register`, input, passwordRegistrationResponseSchema),
    verifyEmail: (realmId: string, token: string) =>
      post(`${realmPath(realmId)}/password/verify-email`, { token }, passwordEmailVerificationResponseSchema),
    whatsappOtpAvailabilityGet: (realmId: string, organizationId?: string) =>
      whatsappOtp.whatsappOtpAvailabilityGet(realmId, organizationId),
    whatsappOtpResend: (realmId: string, challengeId: string, organizationId?: string) =>
      post(
        `${realmPath(realmId)}/whatsapp-otp/resend`,
        { challengeId, ...(organizationId === undefined ? {} : { organizationId }) },
        whatsappOtpResendResponseSchema,
      ),
    whatsappOtpStart: (realmId: string, phoneNumber: string, organizationId?: string) =>
      post(
        `${realmPath(realmId)}/whatsapp-otp/start`,
        { phoneNumber, ...(organizationId === undefined ? {} : { organizationId }) },
        whatsappOtpStartResponseSchema,
      ),
    whatsappOtpVerify: (realmId: string, challengeId: string, code: string, organizationId?: string) =>
      post(
        `${realmPath(realmId)}/whatsapp-otp/verify`,
        { challengeId, code, ...(organizationId === undefined ? {} : { organizationId }) },
        whatsappOtpVerifyResponseSchema,
      ),
  }
}

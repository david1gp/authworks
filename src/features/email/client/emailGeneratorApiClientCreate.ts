import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import {
  type EmailChangeNotificationRenderRequest,
  emailChangeNotificationRenderRequestSchema,
} from "../public/emailChangeNotificationRenderRequestSchema.js"
import {
  type EmailChangeRenderRequest,
  emailChangeRenderRequestSchema,
} from "../public/emailChangeRenderRequestSchema.js"
import { type EmailOtpRenderRequest, emailOtpRenderRequestSchema } from "../public/emailOtpRenderRequestSchema.js"
import {
  type EmailOtpSecurityNotificationRenderRequest,
  emailOtpSecurityNotificationRenderRequestSchema,
} from "../public/emailOtpSecurityNotificationRenderRequestSchema.js"
import {
  type EmailRecoveryRenderRequest,
  emailRecoveryRenderRequestSchema,
} from "../public/emailRecoveryRenderRequestSchema.js"
import { type EmailRenderedMessage, emailRenderedMessageSchema } from "../public/emailRenderedMessageSchema.js"
import {
  type EmailVerificationRenderRequest,
  emailVerificationRenderRequestSchema,
} from "../public/emailVerificationRenderRequestSchema.js"
import {
  type ImpersonationEndedRenderRequest,
  impersonationEndedRenderRequestSchema,
} from "../public/impersonationEndedRenderRequestSchema.js"
import {
  type ImpersonationStartedRenderRequest,
  impersonationStartedRenderRequestSchema,
} from "../public/impersonationStartedRenderRequestSchema.js"
import {
  type OrganizationInvitationRenderRequest,
  organizationInvitationRenderRequestSchema,
} from "../public/organizationInvitationRenderRequestSchema.js"

type EmailGeneratorApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type EmailGeneratorApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: EmailGeneratorApiFetch
}

export function emailGeneratorApiClientCreate(options: EmailGeneratorApiClientCreateOptions) {
  const request = (path: string, input: unknown): Promise<Result<EmailRenderedMessage>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init: { body: JSON.stringify(input), method: "POST" },
      op: "emailGeneratorApiClientRequest",
      path,
      schema: emailRenderedMessageSchema,
    })

  const parsedRequest = <T>(schema: v.GenericSchema<T>, input: unknown, message: string): Result<T> => {
    const parsed = v.safeParse(schema, input)
    if (!parsed.success) return resultErrorCreate("emailGeneratorApiClientCreate", message, "email.invalid")
    return resultCreate(parsed.output)
  }

  const footerWireCreate = (footer: EmailVerificationRenderRequest["footer"]) => ({
    ...footer,
    l: footer.l ?? "en",
  })

  return {
    emailChangeNotificationRender(input: EmailChangeNotificationRenderRequest): Promise<Result<EmailRenderedMessage>> {
      const parsed = parsedRequest(
        emailChangeNotificationRenderRequestSchema,
        input,
        "The email-change notification render request is invalid.",
      )
      if (!parsed.success) return Promise.resolve(parsed)
      return securityNotificationRender(request, "emailChanged", {
        details: [{ label: "New email address", value: parsed.data.notification.newEmail }],
        message:
          "Your Authworks account email address was changed. If you did not request this change, secure your account.",
        subject: "Your email address was changed",
        ...footerWireCreate(parsed.data.footer),
      })
    },
    emailChangeRender(input: EmailChangeRenderRequest): Promise<Result<EmailRenderedMessage>> {
      const parsed = parsedRequest(emailChangeRenderRequestSchema, input, "The email-change render request is invalid.")
      if (!parsed.success) return Promise.resolve(parsed)
      return request("/renderEmailTemplate/emailChangeV1", {
        code: parsed.data.delivery.token,
        expiryMinutes: Math.max(1, Math.ceil((parsed.data.delivery.expiresAt - Date.now()) / 60_000)),
        ...footerWireCreate(parsed.data.footer),
        ...(parsed.data.delivery.userName === undefined ? {} : { userName: parsed.data.delivery.userName }),
        url: parsed.data.url,
      })
    },
    emailOtpSecurityNotificationRender(
      input: EmailOtpSecurityNotificationRenderRequest,
    ): Promise<Result<EmailRenderedMessage>> {
      const parsed = parsedRequest(
        emailOtpSecurityNotificationRenderRequestSchema,
        input,
        "The email OTP security notification render request is invalid.",
      )
      if (!parsed.success) return Promise.resolve(parsed)
      const notification = parsed.data.notification
      const event = `emailOtp${notification.kind[0]?.toUpperCase() ?? ""}${notification.kind.slice(1)}`
      return securityNotificationRender(request, event, {
        details: [
          { label: "User", value: notification.userId },
          { label: "Challenge", value: notification.challengeId },
          ...(notification.attempts === undefined ? [] : [{ label: "Attempts", value: String(notification.attempts) }]),
        ],
        message: emailOtpSecurityNotificationMessageCreate(notification.kind),
        subject: emailOtpSecurityNotificationSubjectCreate(notification.kind),
        ...footerWireCreate(parsed.data.footer),
      })
    },
    emailVerificationRender(input: EmailVerificationRenderRequest): Promise<Result<EmailRenderedMessage>> {
      const parsed = parsedRequest(
        emailVerificationRenderRequestSchema,
        input,
        "The email verification render request is invalid.",
      )
      if (!parsed.success) return Promise.resolve(parsed)
      return request("/renderEmailTemplate/signUpV1", {
        code: parsed.data.delivery.token,
        ...footerWireCreate(parsed.data.footer),
        url: parsed.data.url,
      })
    },
    emailOtpRender(input: EmailOtpRenderRequest): Promise<Result<EmailRenderedMessage>> {
      const parsed = parsedRequest(emailOtpRenderRequestSchema, input, "The email OTP render request is invalid.")
      if (!parsed.success) return Promise.resolve(parsed)
      return request("/renderEmailTemplate/signInV1", {
        code: parsed.data.delivery.code,
        ...footerWireCreate(parsed.data.footer),
        url: parsed.data.url,
      })
    },
    emailRecoveryRender(input: EmailRecoveryRenderRequest): Promise<Result<EmailRenderedMessage>> {
      const parsed = parsedRequest(
        emailRecoveryRenderRequestSchema,
        input,
        "The email recovery render request is invalid.",
      )
      if (!parsed.success) return Promise.resolve(parsed)
      return request("/renderEmailTemplate/passwordChangeV1", {
        code: parsed.data.delivery.token,
        ...footerWireCreate(parsed.data.footer),
        url: parsed.data.url,
      })
    },
    organizationInvitationRender(input: OrganizationInvitationRenderRequest): Promise<Result<EmailRenderedMessage>> {
      const parsed = parsedRequest(
        organizationInvitationRenderRequestSchema,
        input,
        "The organization invitation render request is invalid.",
      )
      if (!parsed.success) return Promise.resolve(parsed)
      return request("/renderEmailTemplate/orgInvitationV1", {
        entity: "organization",
        entityName: parsed.data.delivery.entityName,
        invitedByEmail: parsed.data.delivery.invitedByEmail,
        invitedByName: parsed.data.delivery.invitedByName,
        invitedName: parsed.data.delivery.invitedName,
        ...footerWireCreate(parsed.data.footer),
        url: parsed.data.delivery.url,
      })
    },
    impersonationEndedRender(input: ImpersonationEndedRenderRequest): Promise<Result<EmailRenderedMessage>> {
      const parsed = parsedRequest(
        impersonationEndedRenderRequestSchema,
        input,
        "The impersonation ended render request is invalid.",
      )
      if (!parsed.success) return Promise.resolve(parsed)
      return securityNotificationRender(request, "impersonationEnded", {
        details: impersonationDetailsCreate(parsed.data.notification),
        message: "An impersonation session has ended.",
        subject: "Impersonation ended",
        ...footerWireCreate(parsed.data.footer),
      })
    },
    impersonationStartedRender(input: ImpersonationStartedRenderRequest): Promise<Result<EmailRenderedMessage>> {
      const parsed = parsedRequest(
        impersonationStartedRenderRequestSchema,
        input,
        "The impersonation started render request is invalid.",
      )
      if (!parsed.success) return Promise.resolve(parsed)
      return securityNotificationRender(request, "impersonationStarted", {
        details: impersonationDetailsCreate(parsed.data.notification),
        message: "An administrator started an impersonation session.",
        subject: "Impersonation started",
        ...footerWireCreate(parsed.data.footer),
      })
    },
  }
}

function securityNotificationRender(
  request: (path: string, input: unknown) => Promise<Result<EmailRenderedMessage>>,
  event: string,
  input: Record<string, unknown>,
): Promise<Result<EmailRenderedMessage>> {
  return request("/renderEmailTemplate/securityNotificationV1", { event, ...input })
}

function emailOtpSecurityNotificationMessageCreate(kind: "failed" | "requested" | "verified"): string {
  if (kind === "failed") return "A sign-in verification attempt failed. If this was not you, secure your account."
  if (kind === "verified") return "A sign-in verification code was accepted for your account."
  return "A sign-in verification code was requested for your account."
}

function emailOtpSecurityNotificationSubjectCreate(kind: "failed" | "requested" | "verified"): string {
  if (kind === "failed") return "Sign-in verification failed"
  if (kind === "verified") return "Sign-in verification completed"
  return "Sign-in verification requested"
}

function impersonationDetailsCreate(notification: {
  actorId: string
  endedById?: string
  kind: "ended" | "started"
  organizationId?: string
  realmId: string
  sessionId: string
  subjectId: string
}): { label: string; value: string }[] {
  return [
    { label: "Actor", value: notification.actorId },
    { label: "Subject", value: notification.subjectId },
    { label: "Session", value: notification.sessionId },
    ...(notification.organizationId === undefined
      ? []
      : [{ label: "Organization", value: notification.organizationId }]),
    ...(notification.endedById === undefined ? [] : [{ label: "Ended by", value: notification.endedById }]),
  ]
}

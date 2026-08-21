import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import { type EmailOtpRenderRequest, emailOtpRenderRequestSchema } from "../public/emailOtpRenderRequestSchema.js"
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
  }
}

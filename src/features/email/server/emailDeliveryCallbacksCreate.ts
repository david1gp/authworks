import type { Result } from "#result"
import type { EmailOtpDelivery } from "../../emailOtp/public/emailOtpDeliverySchema.js"
import type { OrganizationInvitationDelivery } from "../../organizations/public/organizationInvitationDeliverySchema.js"
import type { PasswordRecoveryDelivery } from "../../passwords/public/passwordRecoveryDeliverySchema.js"
import type { PasswordRegistrationDelivery } from "../../passwords/public/passwordRegistrationDeliverySchema.js"
import { emailGeneratorApiClientCreate } from "../client/emailGeneratorApiClientCreate.js"
import type { MailDeliveryPort } from "../domain/mailDeliveryPort.js"
import type { EmailRenderedMessage } from "../public/emailRenderedMessageSchema.js"
import type { EmailGeneratorServerConfiguration } from "./emailGeneratorServerConfiguration.js"

type EmailDeliveryCallbacksCreateOptions = {
  readonly emailGenerator: EmailGeneratorServerConfiguration
  readonly mailDelivery: MailDeliveryPort
  readonly publicOrigin: string
}

export function emailDeliveryCallbacksCreate(options: EmailDeliveryCallbacksCreateOptions) {
  const renderer = emailGeneratorApiClientCreate({
    baseUrl: options.emailGenerator.baseUrl,
    fetch: options.emailGenerator.fetch,
  })
  const footer = options.emailGenerator.footer

  return {
    onInvitationDelivery(delivery: OrganizationInvitationDelivery): void {
      emailDeliverySend(
        delivery.email,
        renderer.organizationInvitationRender({
          delivery: {
            email: delivery.email,
            entityName: delivery.entityName,
            invitedByEmail: options.emailGenerator.invitationSender?.email ?? delivery.invitedByEmail,
            invitedByName: options.emailGenerator.invitationSender?.name ?? delivery.invitedByName,
            invitedName: delivery.invitedName,
            url: emailDeliveryUrlCreate(options.publicOrigin, "/invitations/accept", { token: delivery.token }),
          },
          footer,
        }),
        options.mailDelivery,
      )
    },
    onOtpDelivery(delivery: EmailOtpDelivery): void {
      emailDeliverySend(
        delivery.email,
        renderer.emailOtpRender({
          delivery,
          footer,
          url: emailDeliveryUrlCreate(options.publicOrigin, "/login/otp", { realmId: delivery.realmId }),
        }),
        options.mailDelivery,
      )
    },
    onRecoveryToken(delivery: PasswordRecoveryDelivery): void {
      emailDeliverySend(
        delivery.email,
        renderer.emailRecoveryRender({
          delivery,
          footer,
          url: emailDeliveryUrlCreate(options.publicOrigin, "/login/recovery", {
            realmId: delivery.realmId,
            token: delivery.token,
          }),
        }),
        options.mailDelivery,
      )
    },
    onVerificationToken(delivery: PasswordRegistrationDelivery): void {
      emailDeliverySend(
        delivery.email,
        renderer.emailVerificationRender({
          delivery,
          footer,
          url: emailDeliveryUrlCreate(options.publicOrigin, "/login/verify", {
            realmId: delivery.realmId,
            token: delivery.token,
          }),
        }),
        options.mailDelivery,
      )
    },
  }
}

function emailDeliverySend(
  recipient: string,
  rendered: Promise<Result<EmailRenderedMessage>>,
  mailDelivery: MailDeliveryPort,
): void {
  void rendered
    .then((result) => {
      if (!result.success) return
      return mailDelivery.deliver({ message: result.data, to: recipient })
    })
    .catch(() => undefined)
}

function emailDeliveryUrlCreate(publicOrigin: string, path: string, parameters: Record<string, string>): string {
  const origin = new URL(publicOrigin)
  const prefix = origin.pathname === "/" ? "" : origin.pathname.replace(/\/+$/, "")
  const url = new URL(`${origin.origin}${prefix}${path}`)
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value)
  return url.toString()
}

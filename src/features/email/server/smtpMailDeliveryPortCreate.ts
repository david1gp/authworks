import nodemailer from "nodemailer"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { MailDeliveryMessage } from "../domain/mailDeliveryMessage.js"
import type { MailDeliveryPort } from "../domain/mailDeliveryPort.js"
import type { SmtpMailDeliveryPortConfiguration } from "./smtpMailDeliveryPortConfiguration.js"

type SmtpMailTransport = {
  readonly sendMail: (message: {
    readonly from: string
    readonly html: string
    readonly subject: string
    readonly text: string
    readonly to: string
  }) => Promise<unknown>
}

type SmtpMailDeliveryPortCreateOptions = SmtpMailDeliveryPortConfiguration & {
  readonly transport?: SmtpMailTransport
}

export function smtpMailDeliveryPortCreate(options: SmtpMailDeliveryPortCreateOptions): MailDeliveryPort {
  const transport =
    options.transport ??
    nodemailer.createTransport({
      auth: { pass: options.password, user: options.username },
      host: options.host,
      ignoreTLS: options.security === "plain",
      port: options.port,
      requireTLS: options.security === "starttls",
      secure: options.security === "tls",
    })

  return {
    async deliver(delivery: MailDeliveryMessage) {
      const op = "smtpMailDeliveryPortDeliver"
      if (
        mailHeaderValueInvalid(delivery.to) ||
        mailHeaderValueInvalid(delivery.message.subject) ||
        mailHeaderValueInvalid(options.from)
      )
        return resultErrorCreate(op, "SMTP delivery message is invalid.")
      try {
        await transport.sendMail({
          from: options.from,
          html: delivery.message.html,
          subject: delivery.message.subject,
          text: delivery.message.text,
          to: delivery.to,
        })
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCreate(op, "SMTP delivery failed.")
      }
    },
  }
}

function mailHeaderValueInvalid(value: string): boolean {
  return value.length === 0 || /[\r\n]/.test(value)
}

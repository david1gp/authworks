import type { EmailGeneratorServerConfiguration } from "./emailGeneratorServerConfiguration.js"
import type { SmtpMailDeliveryPortConfiguration } from "./smtpMailDeliveryPortConfiguration.js"

export type MailTransportConfiguration = {
  readonly emailGenerator: EmailGeneratorServerConfiguration
  readonly smtp: SmtpMailDeliveryPortConfiguration
}

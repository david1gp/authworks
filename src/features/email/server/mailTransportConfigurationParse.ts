import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { MailTransportConfiguration } from "./mailTransportConfiguration.js"

const supportedLanguages = ["de", "en", "ru", "tj"] as const

export function mailTransportConfigurationParse(
  input: Readonly<Record<string, string | undefined>>,
  publicOrigin?: string,
) {
  const op = "mailTransportConfigurationParse"
  if (!mailTransportEnabled(input.AUTHWORKS_EMAIL_DELIVERY_ENABLED)) return resultCreate<undefined>(undefined)

  const host = requiredValue(input.AUTHWORKS_EMAIL_SMTP_HOST, "AUTHWORKS_EMAIL_SMTP_HOST")
  if (!host.success) return host
  const port = portParse(input.AUTHWORKS_EMAIL_SMTP_PORT, "AUTHWORKS_EMAIL_SMTP_PORT")
  if (!port.success) return port
  const security = securityParse(input.AUTHWORKS_EMAIL_SMTP_SECURITY, "AUTHWORKS_EMAIL_SMTP_SECURITY")
  if (!security.success) return security
  const username = requiredValue(input.AUTHWORKS_EMAIL_SMTP_USERNAME, "AUTHWORKS_EMAIL_SMTP_USERNAME")
  if (!username.success) return username
  const password = requiredValue(input.AUTHWORKS_EMAIL_SMTP_PASSWORD, "AUTHWORKS_EMAIL_SMTP_PASSWORD")
  if (!password.success) return password
  const from = requiredValue(input.AUTHWORKS_EMAIL_SMTP_FROM, "AUTHWORKS_EMAIL_SMTP_FROM")
  if (!from.success) return from
  const generatorBaseUrl = requiredValue(input.AUTHWORKS_EMAIL_GENERATOR_BASE_URL, "AUTHWORKS_EMAIL_GENERATOR_BASE_URL")
  if (!generatorBaseUrl.success) return generatorBaseUrl
  if (!urlValid(generatorBaseUrl.data))
    return resultErrorCreate(op, "Email transport configuration is invalid. Invalid email generator URL.")

  const homepageUrl = input.AUTHWORKS_EMAIL_FOOTER_HOMEPAGE_URL ?? publicOrigin
  if (homepageUrl === undefined || !urlValid(homepageUrl))
    return resultErrorCreate(op, "Email transport configuration is invalid. Invalid footer homepage URL.")
  const language = input.AUTHWORKS_EMAIL_FOOTER_LANGUAGE
  if (language !== undefined && !supportedLanguages.includes(language as (typeof supportedLanguages)[number]))
    return resultErrorCreate(op, "Email transport configuration is invalid. Invalid footer language.")

  const invitationSender = invitationSenderCreate(input)
  if (!invitationSender.success) return invitationSender
  return resultCreate<MailTransportConfiguration>({
    emailGenerator: {
      baseUrl: generatorBaseUrl.data,
      footer: {
        homepageText: input.AUTHWORKS_EMAIL_FOOTER_HOMEPAGE_TEXT ?? "Authworks",
        homepageUrl,
        hompageSubtitle: input.AUTHWORKS_EMAIL_FOOTER_HOMEPAGE_SUBTITLE ?? "Secure identity",
        ...(language === undefined ? {} : { l: language as (typeof supportedLanguages)[number] }),
        ...(input.AUTHWORKS_EMAIL_FOOTER_LEGAL_SIGNATURE === undefined
          ? {}
          : { legalCompanySignature: input.AUTHWORKS_EMAIL_FOOTER_LEGAL_SIGNATURE }),
      },
      ...(invitationSender.data === undefined ? {} : { invitationSender: invitationSender.data }),
    },
    smtp: {
      from: from.data,
      host: host.data,
      password: password.data,
      port: port.data,
      security: security.data,
      username: username.data,
    },
  })
}

function invitationSenderCreate(input: Readonly<Record<string, string | undefined>>) {
  const email = input.AUTHWORKS_EMAIL_INVITATION_SENDER_EMAIL
  const name = input.AUTHWORKS_EMAIL_INVITATION_SENDER_NAME
  if (email === undefined && name === undefined) return resultCreate<undefined>(undefined)
  if (email === undefined || name === undefined || email.length === 0 || name.length === 0)
    return resultErrorCreate("mailTransportConfigurationParse", "Email invitation sender configuration is incomplete.")
  return resultCreate({ email, name })
}

function mailTransportEnabled(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true"
}

function portParse(value: string | undefined, name: string) {
  const parsed = value === undefined || !/^\d+$/.test(value) ? Number.NaN : Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 65_535)
    return resultErrorCreate(
      "mailTransportConfigurationParse",
      `Email transport configuration is missing or invalid: ${name}.`,
    )
  return resultCreate(parsed)
}

function requiredValue(value: string | undefined, name: string) {
  if (value === undefined || value.length === 0)
    return resultErrorCreate("mailTransportConfigurationParse", `Email transport configuration is missing: ${name}.`)
  return resultCreate(value)
}

function securityParse(value: string | undefined, name: string): Result<"plain" | "starttls" | "tls"> {
  if (value !== "plain" && value !== "starttls" && value !== "tls")
    return resultErrorCreate(
      "mailTransportConfigurationParse",
      `Email transport configuration is missing or invalid: ${name}.`,
    )
  return resultCreate(value)
}

function urlValid(value: string): boolean {
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  return (url.protocol === "http:" || url.protocol === "https:") && url.username === "" && url.password === ""
}

import { expect, test } from "bun:test"
import { imapMailReceivePortCreate } from "../../src/features/email/server/imapMailReceivePortCreate.js"
import { smtpMailDeliveryPortCreate } from "../../src/features/email/server/smtpMailDeliveryPortCreate.js"

const enabled =
  process.env.AUTHWORKS_MAILCOW_E2E_ENABLED === "1" || process.env.AUTHWORKS_MAILCOW_E2E_ENABLED === "true"

test.skipIf(!enabled)("Mailcow sends through SMTP and receives through IMAP", async () => {
  const smtpUsername = requiredEnvironment("AUTHWORKS_MAILCOW_SMTP_USERNAME")
  const smtpPassword = requiredEnvironment("AUTHWORKS_MAILCOW_SMTP_PASSWORD")
  const imapUsername = requiredEnvironment("AUTHWORKS_MAILCOW_IMAP_USERNAME")
  const imapPassword = requiredEnvironment("AUTHWORKS_MAILCOW_IMAP_PASSWORD")
  expect(smtpUsername).toBe("it@contentoren.de")
  expect(imapUsername).toBe("auth@contentoren.de")
  const subject = `Authworks Mailcow E2E ${Date.now()}`
  const marker = `mailcow-marker-${Date.now()}`

  const smtp = smtpMailDeliveryPortCreate({
    from: smtpUsername,
    host: requiredEnvironment("AUTHWORKS_MAILCOW_SMTP_HOST"),
    password: smtpPassword,
    port: requiredPort("AUTHWORKS_MAILCOW_SMTP_PORT"),
    security: requiredSecurity("AUTHWORKS_MAILCOW_SMTP_SECURITY"),
    username: smtpUsername,
  })
  const imap = imapMailReceivePortCreate({
    host: requiredEnvironment("AUTHWORKS_MAILCOW_IMAP_HOST"),
    mailbox: process.env.AUTHWORKS_MAILCOW_IMAP_MAILBOX ?? "INBOX",
    password: imapPassword,
    port: requiredPort("AUTHWORKS_MAILCOW_IMAP_PORT"),
    security: requiredSecurity("AUTHWORKS_MAILCOW_IMAP_SECURITY"),
    username: imapUsername,
  })

  const sent = await smtp.deliver({
    message: {
      html: `<p>${marker}</p>`,
      subject,
      text: marker,
    },
    to: imapUsername,
  })
  expect(sent.success).toBe(true)
  if (!sent.success) return

  const received = await imap.receive({
    subjectContains: subject,
    timeoutMs: 45_000,
    to: imapUsername,
  })
  expect(received.success).toBe(true)
  if (!received.success) return
  expect(received.data.some((message) => message.source.includes(marker))).toBe(true)
})

function requiredEnvironment(name: string): string {
  const value = process.env[name]
  if (value === undefined || value.length === 0) throw new Error(`${name} is required when Mailcow E2E is enabled.`)
  return value
}

function requiredPort(name: string): number {
  const value = Number(requiredEnvironment(name))
  if (!Number.isSafeInteger(value) || value < 1 || value > 65_535) throw new Error(`${name} must be a valid port.`)
  return value
}

function requiredSecurity(name: string): "plain" | "starttls" | "tls" {
  const value = requiredEnvironment(name)
  if (value !== "plain" && value !== "starttls" && value !== "tls") throw new Error(`${name} is invalid.`)
  return value
}

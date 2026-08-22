import { expect, test } from "bun:test"
import type { MailDeliveryMessage } from "../../src/features/email/domain/mailDeliveryMessage.js"
import { imapMailReceivePortCreate } from "../../src/features/email/server/imapMailReceivePortCreate.js"
import { mailTransportConfigurationParse } from "../../src/features/email/server/mailTransportConfigurationParse.js"
import { smtpMailDeliveryPortCreate } from "../../src/features/email/server/smtpMailDeliveryPortCreate.js"

test("SMTP delivery maps rendered messages to the configured transport without reading process state", async () => {
  let sent: Record<string, unknown> | undefined
  const delivery = smtpMailDeliveryPortCreate({
    from: "sender@example.test",
    host: "smtp.example.test",
    password: "not-a-real-password",
    port: 587,
    security: "starttls",
    transport: {
      async sendMail(message) {
        sent = message as Record<string, unknown>
        return undefined
      },
    },
    username: "sender@example.test",
  })
  const message: MailDeliveryMessage = {
    message: { html: "<p>Hello</p>", subject: "Welcome", text: "Hello" },
    to: "recipient@example.test",
  }

  const result = await delivery.deliver(message)

  expect(result.success).toBe(true)
  expect(sent).toEqual({
    from: "sender@example.test",
    html: "<p>Hello</p>",
    subject: "Welcome",
    text: "Hello",
    to: "recipient@example.test",
  })
})

test("SMTP delivery turns transport failures into a safe Result error", async () => {
  const delivery = smtpMailDeliveryPortCreate({
    from: "sender@example.test",
    host: "smtp.example.test",
    password: "not-a-real-password",
    port: 587,
    security: "tls",
    transport: {
      async sendMail() {
        throw new Error("credentials must not appear in the Result")
      },
    },
    username: "sender@example.test",
  })

  const result = await delivery.deliver({
    message: { html: "<p>Hello</p>", subject: "Welcome", text: "Hello" },
    to: "recipient@example.test",
  })

  expect(result.success).toBe(false)
  if (result.success) return
  expect(result.errorMessage).toBe("SMTP delivery failed.")
  expect(result.errorMessage).not.toContain("credentials")
})

test("IMAP receive reads and filters messages through the receive port", async () => {
  let released = false
  let loggedOut = false
  const receive = imapMailReceivePortCreate({
    client: {
      async connect() {},
      async fetchAll() {
        return [
          {
            envelope: {
              from: [{ address: "sender@example.test" }],
              subject: "Authworks verification",
              to: [{ address: "recipient@example.test" }],
            },
            seq: 1,
            source: Buffer.from("Subject: Authworks verification\r\n\r\nmarker"),
            uid: 10,
          },
        ]
      },
      async getMailboxLock() {
        return {
          path: "INBOX",
          release() {
            released = true
          },
        }
      },
      async logout() {
        loggedOut = true
      },
      async search() {
        return [10]
      },
      close() {},
    },
    host: "imap.example.test",
    mailbox: "INBOX",
    password: "not-a-real-password",
    port: 993,
    security: "tls",
    username: "recipient@example.test",
  })

  const result = await receive.receive({ subjectContains: "verification", to: "recipient@example.test" })

  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data[0]).toMatchObject({
    source: "Subject: Authworks verification\r\n\r\nmarker",
    subject: "Authworks verification",
    to: ["recipient@example.test"],
    uid: 10,
  })
  expect(released).toBe(true)
  expect(loggedOut).toBe(true)
})

test("email transport configuration remains disabled unless explicitly enabled", () => {
  const disabled = mailTransportConfigurationParse({
    AUTHWORKS_EMAIL_SMTP_PASSWORD: "must be ignored",
  })
  expect(disabled).toEqual({ data: undefined, success: true })

  const invalid = mailTransportConfigurationParse(
    { AUTHWORKS_EMAIL_DELIVERY_ENABLED: "true" },
    "https://auth.example.test",
  )
  expect(invalid.success).toBe(false)
})

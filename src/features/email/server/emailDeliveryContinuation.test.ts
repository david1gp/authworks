import { expect, test } from "bun:test"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { emailDeliveryCallbacksCreate } from "./emailDeliveryCallbacksCreate.js"

test("verification email URL carries the exact local continuation into a separate browser", async () => {
  let body: { url?: string } = {}
  let notify: () => void = () => undefined
  const rendered = new Promise<void>((resolve) => {
    notify = resolve
  })
  const callbacks = emailDeliveryCallbacksCreate({
    publicOrigin: "https://login.example.com",
    emailGenerator: {
      baseUrl: "https://renderer.example.com",
      footer: { homepageText: "Home", homepageUrl: "https://example.com", hompageSubtitle: "Home" },
      fetch: async (_url, init) => {
        body = JSON.parse(String(init?.body)) as { url?: string }
        notify()
        return Response.json({ subject: "Verify", html: "Verify", text: "Verify" })
      },
    },
    mailDelivery: { deliver: async () => resultCreate(undefined) },
  })
  const returnTo = "/invitations/accept?token=a%2Bb%3D&next=x#part"
  callbacks.onVerificationToken({
    email: "invitee@example.com",
    realmId: "realm",
    token: "x".repeat(32),
    userId: "user",
    returnTo,
  })
  await rendered
  const url = new URL(body.url ?? "")
  expect(url.pathname).toBe("/login/verify-email")
  expect(url.searchParams.get("return_to")).toBe(returnTo)
  expect(url.searchParams.get("token")).toBe("x".repeat(32))
})

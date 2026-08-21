import type { EmailOtpRenderRequest } from "../public/emailOtpRenderRequestSchema.js"
import { emailPreviewFooterFixture } from "./emailPreviewFooterFixture.js"

export const emailOtpPreviewFixture: EmailOtpRenderRequest = {
  delivery: {
    challengeId: "challenge-preview",
    code: "123456",
    email: "member@example.test",
    expiresAt: 1_800_000_000_000,
    purpose: "sign_in",
    realmId: "realm-preview",
    userId: "user-preview",
  },
  footer: emailPreviewFooterFixture,
  url: "https://authworks.example.test/login/otp",
}

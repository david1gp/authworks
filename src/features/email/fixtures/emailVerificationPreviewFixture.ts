import type { EmailVerificationRenderRequest } from "../public/emailVerificationRenderRequestSchema.js"
import { emailPreviewFooterFixture } from "./emailPreviewFooterFixture.js"

export const emailVerificationPreviewFixture: EmailVerificationRenderRequest = {
  delivery: {
    email: "member@example.test",
    realmId: "realm-preview",
    token: "verification-token-00000000000000000000000000000000",
    userId: "user-preview",
  },
  footer: emailPreviewFooterFixture,
  url: "https://authworks.example.test/verify?token=verification-token-00000000000000000000000000000000",
}

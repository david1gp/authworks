import type { EmailRecoveryRenderRequest } from "../public/emailRecoveryRenderRequestSchema.js"
import { emailPreviewFooterFixture } from "./emailPreviewFooterFixture.js"

export const emailRecoveryPreviewFixture: EmailRecoveryRenderRequest = {
  delivery: {
    email: "member@example.test",
    realmId: "realm-preview",
    token: "recovery-token-0000000000000000000000000000000000",
    userId: "user-preview",
  },
  footer: emailPreviewFooterFixture,
  url: "https://authworks.example.test/recovery?token=recovery-token-0000000000000000000000000000000000",
}

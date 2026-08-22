import type { EmailOtpSecurityNotificationRenderRequest } from "../public/emailOtpSecurityNotificationRenderRequestSchema.js"
import { emailPreviewFooterFixture } from "./emailPreviewFooterFixture.js"

export const emailOtpSecurityVerifiedPreviewFixture: EmailOtpSecurityNotificationRenderRequest = {
  footer: emailPreviewFooterFixture,
  notification: {
    challengeId: "challenge-security-verified",
    kind: "verified",
    realmId: "realm-preview",
    userId: "user-preview",
  },
}

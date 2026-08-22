import type { EmailOtpSecurityNotificationRenderRequest } from "../public/emailOtpSecurityNotificationRenderRequestSchema.js"
import { emailPreviewFooterFixture } from "./emailPreviewFooterFixture.js"

export const emailOtpSecurityFailedPreviewFixture: EmailOtpSecurityNotificationRenderRequest = {
  footer: emailPreviewFooterFixture,
  notification: {
    attempts: 3,
    challengeId: "challenge-security-failed",
    kind: "failed",
    realmId: "realm-preview",
    userId: "user-preview",
  },
}

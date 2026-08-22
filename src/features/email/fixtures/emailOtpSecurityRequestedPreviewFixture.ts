import type { EmailOtpSecurityNotificationRenderRequest } from "../public/emailOtpSecurityNotificationRenderRequestSchema.js"
import { emailPreviewFooterFixture } from "./emailPreviewFooterFixture.js"

export const emailOtpSecurityRequestedPreviewFixture: EmailOtpSecurityNotificationRenderRequest = {
  footer: emailPreviewFooterFixture,
  notification: {
    challengeId: "challenge-security-requested",
    kind: "requested",
    realmId: "realm-preview",
    userId: "user-preview",
  },
}

import type { EmailOtpSecurityNotification } from "../public/emailOtpSecurityNotificationSchema.js"

export function emailOtpSecurityNotificationLogCreate(): (notification: EmailOtpSecurityNotification) => void {
  return (notification) => {
    console.info(
      JSON.stringify({
        attempts: notification.attempts ?? null,
        challengeId: notification.challengeId,
        event: "email-otp.security-notification",
        kind: notification.kind,
        realmId: notification.realmId,
        userId: notification.userId,
      }),
    )
  }
}

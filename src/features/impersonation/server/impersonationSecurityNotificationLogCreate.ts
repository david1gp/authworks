import type { ImpersonationSecurityNotification } from "../public/impersonationSecurityNotificationSchema.js"

export function impersonationSecurityNotificationLogCreate(): (
  notification: ImpersonationSecurityNotification,
) => void {
  return (notification) => {
    console.info(
      JSON.stringify({
        actorId: notification.actorId,
        event: "impersonation.security-notification",
        kind: notification.kind,
        organizationId: notification.organizationId ?? null,
        realmId: notification.realmId,
        sessionId: notification.sessionId,
        subjectId: notification.subjectId,
      }),
    )
  }
}

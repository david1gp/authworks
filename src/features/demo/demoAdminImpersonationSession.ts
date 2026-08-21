import type { ImpersonationAdminSession } from "../impersonation/ui/impersonationAdminAdapter.js"
import { demoAdminImpersonationNow } from "./demoAdminImpersonationNow.js"

/** An active impersonation, used by the active, expiring, banner, and ended demo states. */
export const demoAdminImpersonationSession: ImpersonationAdminSession = {
  actorId: "01900000-0000-7000-8000-0000000000b1",
  actorLabel: "Robin Vale",
  expiresAt: demoAdminImpersonationNow + 600_000,
  organizationId: "01900000-0000-7000-8000-000000000011",
  reason: "Ticket NW-4821: reproduce the reported checkout failure.",
  sessionId: "01900000-0000-7000-8000-0000000000e1",
  startedAt: demoAdminImpersonationNow,
  subjectId: "01900000-0000-7000-8000-000000000021",
  subjectLabel: "Alex Morgan",
}

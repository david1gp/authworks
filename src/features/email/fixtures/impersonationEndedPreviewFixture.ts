import type { ImpersonationEndedRenderRequest } from "../public/impersonationEndedRenderRequestSchema.js"
import { emailPreviewFooterFixture } from "./emailPreviewFooterFixture.js"

export const impersonationEndedPreviewFixture: ImpersonationEndedRenderRequest = {
  footer: emailPreviewFooterFixture,
  notification: {
    actorId: "admin-preview",
    endedById: "admin-preview",
    kind: "ended",
    organizationId: "organization-preview",
    realmId: "realm-preview",
    sessionId: "session-impersonation-preview",
    subjectId: "user-preview",
  },
}

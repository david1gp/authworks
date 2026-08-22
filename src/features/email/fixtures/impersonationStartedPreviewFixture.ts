import type { ImpersonationStartedRenderRequest } from "../public/impersonationStartedRenderRequestSchema.js"
import { emailPreviewFooterFixture } from "./emailPreviewFooterFixture.js"

export const impersonationStartedPreviewFixture: ImpersonationStartedRenderRequest = {
  footer: emailPreviewFooterFixture,
  notification: {
    actorId: "admin-preview",
    kind: "started",
    organizationId: "organization-preview",
    realmId: "realm-preview",
    sessionId: "session-impersonation-preview",
    subjectId: "user-preview",
  },
}

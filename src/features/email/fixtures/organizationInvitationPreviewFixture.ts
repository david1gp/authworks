import type { OrganizationInvitationRenderRequest } from "../public/organizationInvitationRenderRequestSchema.js"
import { emailPreviewFooterFixture } from "./emailPreviewFooterFixture.js"

export const organizationInvitationPreviewFixture: OrganizationInvitationRenderRequest = {
  delivery: {
    email: "member@example.test",
    entityName: "Preview Organization",
    invitedByEmail: "admin@example.test",
    invitedByName: "Preview Administrator",
    invitedName: "Preview Member",
    url: "https://authworks.example.test/invitations/accept?token=invitation-token-preview",
  },
  footer: emailPreviewFooterFixture,
}

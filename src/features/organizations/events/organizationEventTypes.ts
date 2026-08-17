export const organizationEventTypes = {
  invitationAccepted: "organization.invitation_accepted",
  invitationCreated: "organization.invitation_created",
  invitationDeclined: "organization.invitation_declined",
  invitationExpired: "organization.invitation_expired",
  invitationRevoked: "organization.invitation_revoked",
  membershipAdded: "organization.membership_added",
  membershipRemoved: "organization.membership_removed",
  membershipUpdated: "organization.membership_updated",
  created: "organization.created",
  switched: "organization.switched",
  updated: "organization.updated",
  statusChanged: "organization.status_changed",
} as const

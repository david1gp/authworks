import type { OrganizationInvitation } from "../organizations/public/organizationInvitationSchema.js"

export const demoAdminOrganizationInvitations: OrganizationInvitation[] = [
  {
    acceptedAt: null,
    createdAt: 1_755_609_600_000,
    email: "rowan@example.com",
    expiresAt: 1_756_214_400_000,
    id: "01900000-0000-7000-8000-000000000071",
    organizationId: "01900000-0000-7000-8000-000000000011",
    realmId: "01900000-0000-7000-8000-000000000001",
    roles: ["member"],
    status: "pending",
    updatedAt: 1_755_609_600_000,
  },
  {
    acceptedAt: 1_755_436_800_000,
    createdAt: 1_755_177_600_000,
    email: "sam@example.com",
    expiresAt: 1_755_782_400_000,
    id: "01900000-0000-7000-8000-000000000072",
    organizationId: "01900000-0000-7000-8000-000000000011",
    realmId: "01900000-0000-7000-8000-000000000001",
    roles: ["admin", "member"],
    status: "accepted",
    updatedAt: 1_755_436_800_000,
  },
] satisfies OrganizationInvitation[]

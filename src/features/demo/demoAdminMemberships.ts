import type { OrganizationMembership } from "../organizations/public/organizationMembershipSchema.js"

export const demoAdminMemberships: OrganizationMembership[] = [
  {
    createdAt: 1_754_054_400_000,
    id: "01900000-0000-7000-8000-000000000061",
    realmId: "01900000-0000-7000-8000-000000000001",
    organizationId: "01900000-0000-7000-8000-000000000011",
    roles: ["owner"],
    updatedAt: 1_755_782_400_000,
    userId: "01900000-0000-7000-8000-000000000021",
  },
  {
    createdAt: 1_754_486_400_000,
    id: "01900000-0000-7000-8000-000000000062",
    realmId: "01900000-0000-7000-8000-000000000001",
    organizationId: "01900000-0000-7000-8000-000000000011",
    roles: ["member"],
    updatedAt: 1_755_609_600_000,
    userId: "01900000-0000-7000-8000-000000000022",
  },
  {
    createdAt: 1_754_918_400_000,
    id: "01900000-0000-7000-8000-000000000063",
    realmId: "01900000-0000-7000-8000-000000000001",
    organizationId: "01900000-0000-7000-8000-000000000012",
    roles: ["admin", "member"],
    updatedAt: 1_755_177_600_000,
    userId: "01900000-0000-7000-8000-000000000023",
  },
] satisfies OrganizationMembership[]

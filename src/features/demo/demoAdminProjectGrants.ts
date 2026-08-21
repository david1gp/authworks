import type { ProjectGrant } from "../projects/public/projectGrantSchema.js"

export const demoAdminProjectGrants: ProjectGrant[] = [
  {
    createdAt: 1_754_054_400_000,
    grantedOrganizationId: "01900000-0000-7000-8000-000000000012",
    id: "01900000-0000-7000-8000-000000000061",
    realmId: "01900000-0000-7000-8000-000000000001",
    organizationId: "01900000-0000-7000-8000-000000000011",
    projectId: "01900000-0000-7000-8000-000000000031",
    roleKeys: ["reader"],
    status: "active",
    updatedAt: 1_755_782_400_000,
  },
  {
    createdAt: 1_754_140_800_000,
    grantedOrganizationId: "01900000-0000-7000-8000-000000000013",
    id: "01900000-0000-7000-8000-000000000062",
    realmId: "01900000-0000-7000-8000-000000000001",
    organizationId: "01900000-0000-7000-8000-000000000011",
    projectId: "01900000-0000-7000-8000-000000000031",
    roleKeys: ["admin", "reader"],
    status: "inactive",
    updatedAt: 1_755_696_000_000,
  },
] satisfies ProjectGrant[]

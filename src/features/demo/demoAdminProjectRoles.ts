import type { ProjectRole } from "../projects/public/projectRoleSchema.js"

export const demoAdminProjectRoles: ProjectRole[] = [
  {
    createdAt: 1_754_054_400_000,
    displayName: "Administrator",
    group: "Operations",
    id: "01900000-0000-7000-8000-000000000041",
    realmId: "01900000-0000-7000-8000-000000000001",
    key: "admin",
    projectId: "01900000-0000-7000-8000-000000000031",
    updatedAt: 1_755_782_400_000,
  },
  {
    createdAt: 1_754_054_400_000,
    displayName: "Reader",
    id: "01900000-0000-7000-8000-000000000042",
    realmId: "01900000-0000-7000-8000-000000000001",
    key: "reader",
    projectId: "01900000-0000-7000-8000-000000000031",
    updatedAt: 1_755_782_400_000,
  },
  {
    createdAt: 1_754_486_400_000,
    displayName: "Support",
    group: "Customer success",
    id: "01900000-0000-7000-8000-000000000043",
    realmId: "01900000-0000-7000-8000-000000000001",
    key: "support",
    projectId: "01900000-0000-7000-8000-000000000032",
    updatedAt: 1_755_609_600_000,
  },
] satisfies ProjectRole[]

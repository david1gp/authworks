import type { ProjectUserAssignment } from "../projects/public/projectUserAssignmentSchema.js"

export const demoAdminProjectAssignments: ProjectUserAssignment[] = [
  {
    createdAt: 1_754_054_400_000,
    id: "01900000-0000-7000-8000-000000000151",
    projectId: "01900000-0000-7000-8000-000000000031",
    realmId: "01900000-0000-7000-8000-000000000001",
    roleKeys: ["admin", "reader"],
    updatedAt: 1_755_782_400_000,
    userId: "01900000-0000-7000-8000-000000000101",
  },
  {
    createdAt: 1_754_140_800_000,
    id: "01900000-0000-7000-8000-000000000152",
    projectId: "01900000-0000-7000-8000-000000000031",
    realmId: "01900000-0000-7000-8000-000000000001",
    roleKeys: ["reader"],
    updatedAt: 1_755_696_000_000,
    userId: "01900000-0000-7000-8000-000000000102",
  },
  {
    createdAt: 1_754_486_400_000,
    id: "01900000-0000-7000-8000-000000000153",
    projectId: "01900000-0000-7000-8000-000000000032",
    realmId: "01900000-0000-7000-8000-000000000001",
    roleKeys: ["support"],
    updatedAt: 1_755_609_600_000,
    userId: "01900000-0000-7000-8000-000000000103",
  },
] satisfies ProjectUserAssignment[]

import type { Project } from "../projects/public/projectSchema.js"

export const demoAdminProjects: Project[] = [
  {
    authorizationRequired: true,
    createdAt: 1_754_054_400_000,
    id: "01900000-0000-7000-8000-000000000031",
    realmId: "01900000-0000-7000-8000-000000000001",
    name: "Acme Portal",
    organizationId: "01900000-0000-7000-8000-000000000011",
    projectAccessRequired: false,
    status: "active",
    updatedAt: 1_755_782_400_000,
  },
  {
    authorizationRequired: false,
    createdAt: 1_754_486_400_000,
    id: "01900000-0000-7000-8000-000000000032",
    realmId: "01900000-0000-7000-8000-000000000001",
    name: "Globex Console",
    organizationId: "01900000-0000-7000-8000-000000000012",
    projectAccessRequired: true,
    status: "active",
    updatedAt: 1_755_609_600_000,
  },
] satisfies Project[]

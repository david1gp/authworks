import type { ProjectApplication } from "../projects/public/projectApplicationSchema.js"

export const demoAdminProjectApplications: ProjectApplication[] = [
  {
    applicationType: "oidc",
    createdAt: 1_754_054_400_000,
    id: "01900000-0000-7000-8000-000000000051",
    realmId: "01900000-0000-7000-8000-000000000001",
    name: "Acme Web Portal",
    projectId: "01900000-0000-7000-8000-000000000031",
    status: "active",
    updatedAt: 1_755_782_400_000,
  },
  {
    applicationType: "api",
    createdAt: 1_754_140_800_000,
    id: "01900000-0000-7000-8000-000000000052",
    realmId: "01900000-0000-7000-8000-000000000001",
    name: "Acme Billing API",
    projectId: "01900000-0000-7000-8000-000000000031",
    status: "active",
    updatedAt: 1_755_696_000_000,
  },
  {
    applicationType: "oidc",
    createdAt: 1_754_227_200_000,
    id: "01900000-0000-7000-8000-000000000053",
    realmId: "01900000-0000-7000-8000-000000000001",
    name: "Acme Legacy Intranet",
    projectId: "01900000-0000-7000-8000-000000000031",
    status: "inactive",
    updatedAt: 1_755_609_600_000,
  },
  {
    applicationType: "saml",
    createdAt: 1_754_486_400_000,
    id: "01900000-0000-7000-8000-000000000054",
    realmId: "01900000-0000-7000-8000-000000000001",
    name: "Globex Partner SSO",
    projectId: "01900000-0000-7000-8000-000000000032",
    status: "active",
    updatedAt: 1_755_609_600_000,
  },
] satisfies ProjectApplication[]

import type { Organization } from "../organizations/public/organizationSchema.js"

export const demoAdminOrganizations: Organization[] = [
  {
    createdAt: 1_753_968_000_000,
    id: "01900000-0000-7000-8000-000000000011",
    realmId: "01900000-0000-7000-8000-000000000001",
    name: "Acme Corporation",
    status: "active",
    updatedAt: 1_755_782_400_000,
  },
  {
    createdAt: 1_753_968_000_000,
    id: "01900000-0000-7000-8000-000000000012",
    realmId: "01900000-0000-7000-8000-000000000001",
    name: "Globex Corporation",
    status: "inactive",
    updatedAt: 1_755_696_000_000,
  },
  {
    createdAt: 1_754_054_400_000,
    id: "01900000-0000-7000-8000-000000000013",
    realmId: "01900000-0000-7000-8000-000000000001",
    name: "Initech Partners",
    status: "active",
    updatedAt: 1_755_782_400_000,
  },
] satisfies Organization[]

import type { OrganizationDomain } from "../organizations/public/organizationDomainSchema.js"

export const demoAdminOrganizationDomains: OrganizationDomain[] = [
  {
    createdAt: 1_754_054_400_000,
    domain: "acme.example",
    isPrimary: true,
    organizationId: "01900000-0000-7000-8000-000000000011",
    realmId: "01900000-0000-7000-8000-000000000001",
    updatedAt: 1_755_782_400_000,
    verified: true,
    version: 3,
  },
  {
    createdAt: 1_755_264_000_000,
    domain: "acme-labs.example",
    isPrimary: false,
    organizationId: "01900000-0000-7000-8000-000000000011",
    realmId: "01900000-0000-7000-8000-000000000001",
    updatedAt: 1_755_264_000_000,
    verification: {
      recordName: "_authworks-challenge.acme-labs.example",
      recordType: "TXT",
      recordValue: "authworks-domain-verification=7f3c9a21b48e5d06",
    },
    verified: false,
    version: 1,
  },
] satisfies OrganizationDomain[]

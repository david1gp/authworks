import type { OrganizationMe } from "../../organizations/public/organizationMeSchema.js"

export function accountOrganizationMeGet(
  organizations: readonly OrganizationMe[],
  organizationId: string | undefined,
): OrganizationMe | undefined {
  if (organizationId === undefined) return undefined
  return organizations.find((item) => item.organization.id === organizationId)
}

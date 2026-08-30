import type { OrganizationMe } from "../../organizations/public/organizationMeSchema.js"
import { accountOrganizationMeGet } from "./accountOrganizationMeGet.js"

export function accountViewedOrganizationIdResolve(options: {
  readonly activeOrganizationId: string | undefined
  readonly organizations: readonly OrganizationMe[]
  readonly viewedOrganizationId: string | undefined
  readonly viewedOrganizationExplicit: boolean
}): string | undefined {
  const current = accountOrganizationMeGet(options.organizations, options.viewedOrganizationId)
  if (options.viewedOrganizationExplicit && current !== undefined) return options.viewedOrganizationId

  const active = accountOrganizationMeGet(options.organizations, options.activeOrganizationId)
  if (active !== undefined) return active.organization.id
  return options.organizations[0]?.organization.id
}

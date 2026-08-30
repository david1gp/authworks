import type { accountAccessDemoStateCreate } from "./accountAccessDemoStateCreate.js"
import { accountAccessDemoStateCreate as accountAccessDemoStateCreateRun } from "./accountAccessDemoStateCreate.js"

export function accountOrganizationAccessDemoStateCreate(
  organizations: ReturnType<typeof accountAccessDemoStateCreate>,
) {
  const effectiveAccess = accountAccessDemoStateCreateRun(() => "effective-access", {
    viewedOrganizationId: organizations.viewedOrganizationId,
    viewedOrganizationSelect: organizations.viewedOrganizationSelect,
  })
  return {
    effectiveAccess,
    organizations,
    organizationSelect: organizations.viewedOrganizationSelect,
  }
}

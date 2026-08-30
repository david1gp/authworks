import { accountAccessProductionStateCreate } from "./accountAccessProductionStateCreate.js"
import type { ProductionSessionContextValue } from "../../../ui/production/productionSessionContextValue.js"

export function accountOrganizationAccessProductionStateCreate(
  options: { readonly session?: ProductionSessionContextValue } = {},
) {
  const organizations = accountAccessProductionStateCreate(() => "organizations", { session: options.session })
  const effectiveAccess = accountAccessProductionStateCreate(() => "effective-access", {
    session: options.session,
    viewedOrganizationId: organizations.viewedOrganizationId,
    viewedOrganizationSelect: organizations.viewedOrganizationSelect,
  })
  return {
    effectiveAccess,
    organizations,
    organizationSelect: organizations.viewedOrganizationSelect,
  }
}

import { OrganizationAdminScreenView } from "./OrganizationAdminScreenView.js"
import { organizationAdminProductionStateCreate } from "./organizationAdminProductionStateCreate.js"
import type { OrganizationAdminScreen } from "./organizationAdminScreenSchema.js"

export function OrganizationAdminProductionAdapter(props: { readonly screen: OrganizationAdminScreen }) {
  const state = organizationAdminProductionStateCreate(() => props.screen)
  return <OrganizationAdminScreenView state={state} />
}

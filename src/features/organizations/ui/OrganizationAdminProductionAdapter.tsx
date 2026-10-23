import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { OrganizationAdminScreenView } from "../../organizations/ui/OrganizationAdminScreenView.js"
import { OrganizationConfigurationPlaceholder } from "../../organizations/ui/OrganizationConfigurationPlaceholder.js"
import { organizationAdminProductionStateCreate } from "../../organizations/ui/organizationAdminProductionStateCreate.js"
import type { OrganizationAdminScreen } from "../../organizations/ui/organizationAdminScreenSchema.js"

export function OrganizationAdminProductionAdapter(props: { readonly screen: OrganizationAdminScreen }) {
  if (props.screen === "configuration") return <OrganizationConfigurationPlaceholder />
  const state = organizationAdminProductionStateCreate(() => props.screen)
  return (
    <>
      <OrganizationAdminScreenView state={state} />
      <ConfirmDialog state={state.confirmState} titleKey="admin.common.confirmTitle" />
    </>
  )
}

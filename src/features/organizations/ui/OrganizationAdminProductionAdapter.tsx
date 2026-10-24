import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { OrganizationAdminScreenView } from "../../organizations/ui/OrganizationAdminScreenView.js"
import { OrganizationConfigurationProductionAdapter } from "../../organizations/ui/OrganizationConfigurationProductionAdapter.js"
import { organizationAdminProductionStateCreate } from "../../organizations/ui/organizationAdminProductionStateCreate.js"
import type { OrganizationAdminScreen } from "../../organizations/ui/organizationAdminScreenSchema.js"

export function OrganizationAdminProductionAdapter(props: { readonly screen: OrganizationAdminScreen }) {
  if (props.screen === "configuration") return <OrganizationConfigurationProductionAdapter />
  const state = organizationAdminProductionStateCreate(() => props.screen)
  return (
    <>
      <OrganizationAdminScreenView state={state} />
      <ConfirmDialog state={state.confirmState} titleKey="admin.common.confirmTitle" />
    </>
  )
}

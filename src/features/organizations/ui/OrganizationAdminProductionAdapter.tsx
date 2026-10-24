import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { OrganizationAdminScreenView } from "../../organizations/ui/OrganizationAdminScreenView.js"
import { OrganizationConfigurationProductionAdapter } from "../../organizations/ui/OrganizationConfigurationProductionAdapter.js"
import { organizationAdminProductionStateCreate } from "../../organizations/ui/organizationAdminProductionStateCreate.js"
import type { OrganizationAdminScreen } from "../../organizations/ui/organizationAdminScreenSchema.js"

export function OrganizationAdminProductionAdapter(props: {
  readonly organizationId?: string
  readonly screen: OrganizationAdminScreen
  readonly section?: string
}) {
  if (props.screen === "configuration") return <OrganizationConfigurationProductionAdapter section={props.section} />
  const state = organizationAdminProductionStateCreate({
    organizationId: props.organizationId,
    screen: () => props.screen,
  })
  return (
    <>
      <OrganizationAdminScreenView state={state} />
      <ConfirmDialog state={state.confirmState} titleKey="admin.common.confirmTitle" />
    </>
  )
}

import { Show } from "solid-js"
import { OrganizationAdminScreenView } from "../../organizations/ui/OrganizationAdminScreenView.js"
import { OrganizationConfigurationProductionAdapter } from "../../organizations/ui/OrganizationConfigurationProductionAdapter.js"
import { organizationAdminProductionStateCreate } from "../../organizations/ui/organizationAdminProductionStateCreate.js"
import type { OrganizationAdminScreen } from "../../organizations/ui/organizationAdminScreenSchema.js"

type OrganizationAdminProductionAdapterProps = {
  readonly organizationId?: string
  readonly screen: OrganizationAdminScreen
  readonly section?: string
}

export function OrganizationAdminProductionAdapter(props: OrganizationAdminProductionAdapterProps) {
  return (
    <Show when={props.screen === "configuration"} fallback={<OrganizationAdminRoute {...props} />}>
      <OrganizationConfigurationProductionAdapter section={props.section} />
    </Show>
  )
}

function OrganizationAdminRoute(props: OrganizationAdminProductionAdapterProps) {
  const state = organizationAdminProductionStateCreate({
    organizationId: () => props.organizationId,
    screen: () => props.screen,
  })
  return <OrganizationAdminScreenView state={state} />
}

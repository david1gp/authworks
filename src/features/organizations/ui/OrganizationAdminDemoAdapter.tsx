import { OrganizationAdminScreenView } from "./OrganizationAdminScreenView.js"
import { OrganizationConfigurationDemoAdapter } from "./OrganizationConfigurationDemoAdapter.js"
import { organizationAdminDemoStateCreate } from "./organizationAdminDemoStateCreate.js"
import type { OrganizationAdminScreen } from "./organizationAdminScreenSchema.js"

export function OrganizationAdminDemoAdapter(props: { readonly screen: OrganizationAdminScreen }) {
  if (props.screen === "configuration") return <OrganizationConfigurationDemoAdapter />
  const state = organizationAdminDemoStateCreate(() => props.screen)
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <h1 class="sr-only">{state.scenarioTitle()}</h1>
      <OrganizationAdminScreenView state={state} />
    </div>
  )
}

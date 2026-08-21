import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import { OrganizationAdminScreenView } from "./OrganizationAdminScreenView.js"
import { organizationAdminDemoStateCreate } from "./organizationAdminDemoStateCreate.js"
import type { OrganizationAdminScreen } from "./organizationAdminScreenSchema.js"

export function OrganizationAdminDemoAdapter(props: { readonly screen: OrganizationAdminScreen }) {
  const state = organizationAdminDemoStateCreate(() => props.screen)
  return (
    <div class="mx-auto grid max-w-6xl gap-6">
      <DemoFixtureStateSelector options={state.stateOptions()} />
      <OrganizationAdminScreenView state={state} />
    </div>
  )
}

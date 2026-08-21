import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import { OidcAdminScreenView } from "./OidcAdminScreenView.js"
import { oidcAdminDemoStateCreate } from "./oidcAdminDemoStateCreate.js"
import type { OidcAdminScreen } from "./oidcAdminScreenSchema.js"

export function OidcAdminDemoAdapter(props: { readonly clientId?: string; readonly screen: OidcAdminScreen }) {
  const state = oidcAdminDemoStateCreate({
    clientId: () => props.clientId,
    screen: () => props.screen,
  })
  return (
    <div class="mx-auto grid min-w-0 max-w-6xl gap-6">
      <DemoFixtureStateSelector options={state.stateOptions()} />
      <OidcAdminScreenView state={state} />
    </div>
  )
}

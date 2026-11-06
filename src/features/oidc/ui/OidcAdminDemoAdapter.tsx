import { OidcAdminScreenView } from "./OidcAdminScreenView.js"
import { oidcAdminDemoStateCreate } from "./oidcAdminDemoStateCreate.js"
import type { OidcAdminScreen } from "./oidcAdminScreenSchema.js"

export function OidcAdminDemoAdapter(props: { readonly clientId?: string; readonly screen: OidcAdminScreen }) {
  const state = oidcAdminDemoStateCreate({
    clientId: () => props.clientId,
    screen: () => props.screen,
  })
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <OidcAdminScreenView state={state} />
    </div>
  )
}

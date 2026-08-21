import { OidcAdminScreenView } from "./OidcAdminScreenView.js"
import { oidcAdminProductionStateCreate } from "./oidcAdminProductionStateCreate.js"
import type { OidcAdminScreen } from "./oidcAdminScreenSchema.js"

export function OidcAdminProductionAdapter(props: { readonly clientId?: string; readonly screen: OidcAdminScreen }) {
  const state = oidcAdminProductionStateCreate({
    clientId: () => props.clientId,
    screen: () => props.screen,
  })
  return <OidcAdminScreenView state={state} />
}

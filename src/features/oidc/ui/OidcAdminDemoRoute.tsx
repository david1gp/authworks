import { useParams } from "@solidjs/router"
import { OidcAdminDemoAdapter } from "./OidcAdminDemoAdapter.js"
import type { OidcAdminScreen } from "./oidcAdminScreenSchema.js"

/** Binds a `/demo/admin/**` route to an OIDC administration screen. */
export function OidcAdminDemoRoute(props: { readonly screen: OidcAdminScreen }) {
  const params = useParams<{ clientId?: string }>()
  return <OidcAdminDemoAdapter clientId={params.clientId} screen={props.screen} />
}

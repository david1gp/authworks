import { Match, Switch } from "solid-js"
import { OidcAdminClientDetailView } from "./OidcAdminClientDetailView.js"
import { OidcAdminClientListView } from "./OidcAdminClientListView.js"
import { OidcAdminConsentsView } from "./OidcAdminConsentsView.js"
import { OidcAdminProtocolDocumentsView } from "./OidcAdminProtocolDocumentsView.js"
import { OidcAdminSigningKeysView } from "./OidcAdminSigningKeysView.js"
import type { oidcAdminScreenStateCreate } from "./oidcAdminScreenStateCreate.js"

/** The single stateless view shared by the production and demo OIDC adapters. */
export function OidcAdminScreenView(props: { readonly state: ReturnType<typeof oidcAdminScreenStateCreate> }) {
  const state = props.state
  return (
    <Switch>
      <Match when={state.screen() === "oidc-clients"}>
        <OidcAdminClientListView state={state.list} />
      </Match>
      <Match when={state.screen() === "oidc-client-detail"}>
        <OidcAdminClientDetailView state={state.detail} />
      </Match>
      <Match when={state.screen() === "signing-keys"}>
        <OidcAdminSigningKeysView state={state.page} />
      </Match>
      <Match when={state.screen() === "oidc-consents"}>
        <OidcAdminConsentsView state={state.consents} />
      </Match>
      <Match when={state.screen() === "protocol-documents"}>
        <OidcAdminProtocolDocumentsView state={state.page} />
      </Match>
    </Switch>
  )
}

import { Match, Switch } from "solid-js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { AdminRealmPlaceholder } from "./AdminRealmPlaceholder.js"
import { AdminScreenView } from "./AdminScreenView.js"
import { adminProductionStateCreate } from "./adminProductionStateCreate.js"
import type { AdminScreen } from "./adminScreenSchema.js"

/**
 * Temporary production dispatch for admin-owned screens. Existing working views stay mounted
 * for unchanged routes; the merged realm screen renders a placeholder until its page task lands.
 */
export function AdminProductionAdapter(props: { readonly screen: AdminScreen }) {
  const state = adminProductionStateCreate(() => props.screen)
  return (
    <Switch>
      <Match when={props.screen === "realm"}>
        <AdminRealmPlaceholder />
      </Match>
      <Match when={true}>
        <AdminScreenView basePath="/admin" screen={props.screen} state={state} />
        <ConfirmDialog state={state.confirmState} titleKey="admin.common.confirmTitle" />
      </Match>
    </Switch>
  )
}

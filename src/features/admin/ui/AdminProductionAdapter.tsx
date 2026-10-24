import { Match, Switch } from "solid-js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { AdminRealmView } from "./AdminRealmView.js"
import { AdminScreenView } from "./AdminScreenView.js"
import { adminProductionStateCreate } from "./adminProductionStateCreate.js"
import type { AdminScreen } from "./adminScreenSchema.js"

/** Production dispatch for admin-owned screens; the realm screen renders the merged overview and settings. */
export function AdminProductionAdapter(props: { readonly screen: AdminScreen }) {
  const state = adminProductionStateCreate(() => props.screen)
  return (
    <Switch>
      <Match when={props.screen === "realm"}>
        <AdminRealmView basePath="/admin" state={state} />
        <ConfirmDialog state={state.confirmState} titleKey="admin.common.confirmTitle" />
      </Match>
      <Match when={true}>
        <AdminScreenView basePath="/admin" screen={props.screen} state={state} />
        <ConfirmDialog state={state.confirmState} titleKey="admin.common.confirmTitle" />
      </Match>
    </Switch>
  )
}

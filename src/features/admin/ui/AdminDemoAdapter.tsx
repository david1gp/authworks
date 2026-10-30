import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { AdminRealmView } from "./AdminRealmView.js"
import { AdminScreenView } from "./AdminScreenView.js"
import { adminDemoStateCreate } from "./adminDemoStateCreate.js"
import type { AdminScreen } from "./adminScreenSchema.js"

export function AdminDemoAdapter(props: { readonly screen: AdminScreen }) {
  const state = adminDemoStateCreate(() => props.screen)
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      {props.screen === "realm" ? (
        <AdminRealmView basePath="/demo/admin" state={state} />
      ) : (
        <>
          <h1 class="sr-only">{state.scenarioTitle()}</h1>
          <AdminScreenView basePath="/demo/admin" screen={props.screen} state={state} />
        </>
      )}
      <ConfirmDialog state={state.confirmState} titleKey="admin.common.confirmTitle" />
    </div>
  )
}

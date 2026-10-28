import { Show } from "solid-js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import { AdminActivityView } from "./AdminActivityView.js"
import { adminActivityDemoStateCreate } from "./adminActivityDemoStateCreate.js"

export function AdminActivityDemoAdapter() {
  const state = adminActivityDemoStateCreate()
  return (
    <Show when={state.allowed()} fallback={<ProductionStatePanel state="inaccessible" />}>
      <AdminActivityView {...state} />
    </Show>
  )
}

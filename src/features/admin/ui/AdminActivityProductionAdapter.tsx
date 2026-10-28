import { Show } from "solid-js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import { AdminActivityView } from "./AdminActivityView.js"
import { adminActivityProductionStateCreate } from "./adminActivityProductionStateCreate.js"

export function AdminActivityProductionAdapter() {
  const state = adminActivityProductionStateCreate()
  return (
    <Show when={!state.contextError()} fallback={<ProductionStatePanel state="error" onRetry={state.retryContext} />}>
      <Show when={state.ready()} fallback={<ProductionStatePanel state="loading" />}>
        <Show when={state.allowed()} fallback={<ProductionStatePanel state="inaccessible" />}>
          <AdminActivityView {...state} />
        </Show>
      </Show>
    </Show>
  )
}

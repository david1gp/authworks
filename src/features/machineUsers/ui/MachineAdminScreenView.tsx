import { Match, Switch } from "solid-js"
import { MachineAdminCredentialsView } from "./MachineAdminCredentialsView.js"
import { MachineAdminDetailView } from "./MachineAdminDetailView.js"
import { MachineAdminListView } from "./MachineAdminListView.js"
import type { machineAdminScreenStateCreate } from "./machineAdminScreenStateCreate.js"

/** The single stateless view shared by the production and demo machine-user adapters. */
export function MachineAdminScreenView(props: { readonly state: ReturnType<typeof machineAdminScreenStateCreate> }) {
  const state = props.state
  return (
    <Switch>
      <Match when={state.screen() === "machine-users"}>
        <MachineAdminListView state={state.list} />
      </Match>
      <Match when={state.screen() === "machine-user-detail"}>
        <MachineAdminDetailView state={state.detail} />
      </Match>
      <Match when={state.screen() === "machine-credentials"}>
        <MachineAdminCredentialsView state={state.credentials} />
      </Match>
    </Switch>
  )
}

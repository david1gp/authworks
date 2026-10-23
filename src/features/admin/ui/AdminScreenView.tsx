import { Match, Switch } from "solid-js"
import { AdminEventListView } from "./AdminEventListView.js"
import { AdminSessionListView } from "./AdminSessionListView.js"
import { AdminSignInView } from "./AdminSignInView.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"
import type { AdminScreen } from "./adminScreenSchema.js"

/** Renders any administration screen from state alone, without knowing its transport. */
export function AdminScreenView(props: {
  readonly basePath: string
  readonly screen: AdminScreen
  readonly state: ReturnType<typeof adminPageStateCreate>
}) {
  return (
    <Switch>
      <Match when={props.screen === "sign-in"}>
        <AdminSignInView state={props.state} />
      </Match>
      <Match when={props.screen === "sessions"}>
        <AdminSessionListView state={props.state} />
      </Match>
      <Match when={props.screen === "audit-events"}>
        <AdminEventListView state={props.state} />
      </Match>
    </Switch>
  )
}

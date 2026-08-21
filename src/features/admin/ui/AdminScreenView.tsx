import { Match, Switch } from "solid-js"
import { AdminEventListView } from "./AdminEventListView.js"
import { AdminRealmOverviewView } from "./AdminRealmOverviewView.js"
import { AdminRealmView } from "./AdminRealmView.js"
import { AdminSignInView } from "./AdminSignInView.js"
import { AdminUserDetailView } from "./AdminUserDetailView.js"
import { AdminUserListView } from "./AdminUserListView.js"
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
      <Match when={props.screen === "overview"}>
        <AdminRealmOverviewView state={props.state} />
      </Match>
      <Match when={props.screen === "realm"}>
        <AdminRealmView state={props.state} />
      </Match>
      <Match when={props.screen === "users"}>
        <AdminUserListView detailHrefBase={`${props.basePath}/users`} state={props.state} />
      </Match>
      <Match when={props.screen === "user-detail"}>
        <AdminUserDetailView
          backHref={`${props.basePath}/users`}
          impersonationHref={`${props.basePath}/impersonation`}
          state={props.state}
        />
      </Match>
      <Match when={props.screen === "audit-events"}>
        <AdminEventListView state={props.state} />
      </Match>
    </Switch>
  )
}

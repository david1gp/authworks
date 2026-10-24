import { Match, Switch } from "solid-js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { DirectoryAdminUsersProductionAdapter } from "./DirectoryAdminUsersProductionAdapter.js"
import { DirectoryRealmAdministratorsProductionAdapter } from "./DirectoryRealmAdministratorsProductionAdapter.js"
import { DirectoryRolesView } from "./DirectoryRolesView.js"
import { DirectoryUserProfileProductionAdapter } from "./DirectoryUserProfileProductionAdapter.js"
import type { DirectoryAdminScreen } from "./directoryAdminScreenSchema.js"
import { directoryRolesProductionStateCreate } from "./directoryRolesProductionStateCreate.js"

/** Production dispatch for directory screens; the roles screen renders the roles page. */
export function DirectoryAdminProductionAdapter(props: {
  readonly screen: DirectoryAdminScreen
  readonly userId?: string
}) {
  const roles = directoryRolesProductionStateCreate()
  return (
    <Switch>
      <Match when={props.screen === "users"}>
        <DirectoryAdminUsersProductionAdapter />
      </Match>
      <Match when={props.screen === "user-detail"}>
        <DirectoryUserProfileProductionAdapter userId={props.userId} />
      </Match>
      <Match when={props.screen === "roles"}>
        <DirectoryRolesView state={roles.view} />
        <ConfirmDialog state={roles.confirmState} titleKey="admin.common.confirmTitle" />
      </Match>
      <Match when={props.screen === "realm-administrators"}>
        <DirectoryRealmAdministratorsProductionAdapter />
      </Match>
    </Switch>
  )
}

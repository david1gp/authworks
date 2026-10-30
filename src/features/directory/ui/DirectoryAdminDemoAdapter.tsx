import { Match, Switch } from "solid-js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { DirectoryRealmAdministratorsDemoAdapter } from "./DirectoryRealmAdministratorsDemoAdapter.js"
import { DirectoryAdminUsersDemoAdapter } from "./DirectoryAdminUsersDemoAdapter.js"
import { DirectoryRolesView } from "./DirectoryRolesView.js"
import { DirectoryUserProfileDemoAdapter } from "./DirectoryUserProfileDemoAdapter.js"
import type { DirectoryAdminScreen } from "./directoryAdminScreenSchema.js"
import { directoryRolesDemoStateCreate } from "./directoryRolesDemoStateCreate.js"

/** Demo dispatch for directory screens; the roles screen renders fixture-backed roles. */
export function DirectoryAdminDemoAdapter(props: { readonly screen: DirectoryAdminScreen }) {
  const roles = directoryRolesDemoStateCreate()
  return (
    <Switch>
      <Match when={props.screen === "users"}>
        <DirectoryAdminUsersDemoAdapter />
      </Match>
      <Match when={props.screen === "user-detail"}>
        <DirectoryUserProfileDemoAdapter />
      </Match>
      <Match when={props.screen === "roles"}>
        <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
          <h1 class="sr-only">{messageTranslate("demo.admin.scenario.roles.title")}</h1>
          <DirectoryRolesView state={roles.view} />
          <ConfirmDialog state={roles.confirmState} titleKey="admin.common.confirmTitle" />
        </div>
      </Match>
      <Match when={props.screen === "realm-administrators"}>
        <DirectoryRealmAdministratorsDemoAdapter />
      </Match>
    </Switch>
  )
}

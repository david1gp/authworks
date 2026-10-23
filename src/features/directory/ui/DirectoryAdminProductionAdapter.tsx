import { Match, Switch } from "solid-js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { DirectoryAdminPlaceholderPage } from "./DirectoryAdminPlaceholderPage.js"
import { DirectoryRolesView } from "./DirectoryRolesView.js"
import type { DirectoryAdminScreen } from "./directoryAdminScreenSchema.js"
import { directoryRolesProductionStateCreate } from "./directoryRolesProductionStateCreate.js"

/** Production dispatch for directory screens; the roles screen renders the roles page. */
export function DirectoryAdminProductionAdapter(props: { readonly screen: DirectoryAdminScreen }) {
  const roles = directoryRolesProductionStateCreate()
  return (
    <Switch>
      <Match when={props.screen === "users"}>
        <DirectoryAdminPlaceholderPage
          descriptionKey="admin.directory.users.placeholder"
          eyebrowKey="shell.nav.users"
          titleKey="shell.nav.users"
        />
      </Match>
      <Match when={props.screen === "user-detail"}>
        <DirectoryAdminPlaceholderPage
          descriptionKey="admin.directory.users.placeholder"
          eyebrowKey="shell.nav.users"
          titleKey="admin.users.detailTitle"
        />
      </Match>
      <Match when={props.screen === "roles"}>
        <DirectoryRolesView state={roles.view} />
        <ConfirmDialog state={roles.confirmState} titleKey="admin.common.confirmTitle" />
      </Match>
      <Match when={props.screen === "realm-administrators"}>
        <DirectoryAdminPlaceholderPage
          descriptionKey="admin.directory.administrators.placeholder"
          eyebrowKey="shell.nav.realmGroup"
          titleKey="shell.nav.realmAdministrators"
        />
      </Match>
    </Switch>
  )
}

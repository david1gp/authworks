import { Match, Switch } from "solid-js"
import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import { DirectoryAdminPlaceholderPage } from "./DirectoryAdminPlaceholderPage.js"
import { DirectoryRealmAdministratorsDemoAdapter } from "./DirectoryRealmAdministratorsDemoAdapter.js"
import { DirectoryRolesView } from "./DirectoryRolesView.js"
import type { DirectoryAdminScreen } from "./directoryAdminScreenSchema.js"
import { directoryRolesDemoStateCreate } from "./directoryRolesDemoStateCreate.js"

/** Demo dispatch for directory screens; the roles screen renders fixture-backed roles. */
export function DirectoryAdminDemoAdapter(props: { readonly screen: DirectoryAdminScreen }) {
  const roles = directoryRolesDemoStateCreate()
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
        <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
          <AuthenticatedPageHeader
            description={messageTranslate("demo.admin.scenario.roles.description")}
            eyebrow={messageTranslate("demo.fixture.preview")}
            meta={
              <>
                <span class="text-xs font-medium text-muted-foreground">{messageTranslate("demo.fixture.state")}</span>
                <DemoFixtureStateSelector options={roles.stateOptions()} />
              </>
            }
            title={messageTranslate("demo.admin.scenario.roles.title")}
          />
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

import { useNavigate } from "@solidjs/router"
import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import { demoFixtureStateLabel } from "../../demo/public/demoFixtureStateLabel.js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import type { DirectoryAdminUsersViewState } from "./DirectoryAdminUsersView.js"
import { DirectoryAdminUsersView } from "./DirectoryAdminUsersView.js"
import { directoryAdminUsersDemoStateCreate } from "./directoryAdminUsersDemoStateCreate.js"
import { directoryAdminUsersDialogsStateCreate } from "./directoryAdminUsersDialogsStateCreate.js"

/** Demo mount for the users screen: fixture adapter honouring `?as=` plus the shared view. */
export function DirectoryAdminUsersDemoAdapter() {
  const screen = directoryAdminUsersDemoStateCreate()
  const navigate = useNavigate()
  const dialogs = directoryAdminUsersDialogsStateCreate({ page: screen.page })
  const stateOptions = () => {
    const states: readonly ("success" | "empty" | "loading" | "error" | "permission-denied" | "expired")[] = [
      "success",
      "empty",
      "loading",
      "error",
      "permission-denied",
      "expired",
    ]
    return states.map((fixture) => ({
      href: demoFixtureScenarioHrefBuild("/demo/admin/users", fixture),
      label: demoFixtureStateLabel(fixture),
      selected: fixture === screen.fixtureState(),
    }))
  }
  const state: DirectoryAdminUsersViewState = {
    basePath: screen.basePath,
    confirmState: screen.confirmState,
    dialogs,
    navigateProfile: (userId: string) =>
      navigate(`${screen.basePath}/users/${userId}${window.location.search}`, { replace: false }),
    page: screen.page,
  }
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <AuthenticatedPageHeader
        description={messageTranslate("demo.admin.scenario.users.description")}
        eyebrow={messageTranslate("demo.fixture.preview")}
        meta={
          <>
            <span class="text-xs font-medium text-muted-foreground">{messageTranslate("demo.fixture.state")}</span>
            <DemoFixtureStateSelector options={stateOptions()} />
          </>
        }
        title={messageTranslate("demo.admin.scenario.users.title")}
      />
      <DirectoryAdminUsersView state={state} />
    </div>
  )
}

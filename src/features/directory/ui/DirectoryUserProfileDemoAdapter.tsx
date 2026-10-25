import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import type { DirectoryUserProfileViewState } from "./DirectoryUserProfileView.js"
import { DirectoryUserProfileView } from "./DirectoryUserProfileView.js"
import { directoryUserProfileDemoStateCreate } from "./directoryUserProfileDemoStateCreate.js"

/** Demo mount for the user profile screen: fixture adapter honouring `?as=` plus the shared view. */
export function DirectoryUserProfileDemoAdapter() {
  const screen = directoryUserProfileDemoStateCreate()
  const state: DirectoryUserProfileViewState = {
    asParam: screen.asParam,
    basePath: screen.basePath,
    confirmState: screen.confirmState,
    dialog: screen.dialog,
    dialogOpenSet: screen.dialogOpenSet,
    organizationName: screen.organizationName,
    page: screen.page,
    tab: screen.tab,
    userId: screen.userId,
    withActor: screen.withActor,
  }
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <AuthenticatedPageHeader
        description={messageTranslate("demo.admin.scenario.user_detail.description")}
        eyebrow={messageTranslate("demo.fixture.preview")}
        meta={
          <>
            <span class="text-xs font-medium text-muted-foreground">{messageTranslate("demo.fixture.state")}</span>
            <DemoFixtureStateSelector options={screen.stateOptions()} />
          </>
        }
        title={messageTranslate("demo.admin.scenario.user_detail.title")}
      />
      <DirectoryUserProfileView state={state} />
    </div>
  )
}

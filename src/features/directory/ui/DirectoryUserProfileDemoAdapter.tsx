import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
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
      <h1 class="sr-only">{messageTranslate("demo.admin.scenario.user_detail.title")}</h1>
      <DirectoryUserProfileView state={state} />
    </div>
  )
}

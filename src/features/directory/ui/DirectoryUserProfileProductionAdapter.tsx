import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import type { DirectoryUserProfileViewState } from "./DirectoryUserProfileView.js"
import { DirectoryUserProfileView } from "./DirectoryUserProfileView.js"
import { directoryUserProfileProductionStateCreate } from "./directoryUserProfileProductionStateCreate.js"

/** Production mount for the user profile screen: session-bound adapter plus the shared view. */
export function DirectoryUserProfileProductionAdapter() {
  const screen = directoryUserProfileProductionStateCreate()
  const state: DirectoryUserProfileViewState = {
    asParam: undefined,
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
    <>
      <DirectoryUserProfileView state={state} />
      <ConfirmDialog state={screen.confirmState} titleKey="admin.common.confirmTitle" />
    </>
  )
}

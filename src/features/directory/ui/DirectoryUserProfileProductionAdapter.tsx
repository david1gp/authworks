import type { DirectoryUserProfileViewState } from "./DirectoryUserProfileView.js"
import { DirectoryUserProfileView } from "./DirectoryUserProfileView.js"
import { directoryUserProfileProductionStateCreate } from "./directoryUserProfileProductionStateCreate.js"

/** Production mount for the user profile screen: session-bound adapter plus the shared view. */
export function DirectoryUserProfileProductionAdapter(props: { readonly userId?: string }) {
  const screen = directoryUserProfileProductionStateCreate({ userId: props.userId })
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
  // The view renders the single shared ConfirmDialog; a second mount on the same state
  // re-opens the focus trap against itself and dismisses confirmations instantly.
  return <DirectoryUserProfileView state={state} />
}

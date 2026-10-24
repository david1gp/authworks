import type { DirectoryAdminUsersViewState } from "./DirectoryAdminUsersView.js"
import { DirectoryAdminUsersView } from "./DirectoryAdminUsersView.js"
import { directoryAdminUsersDialogsStateCreate } from "./directoryAdminUsersDialogsStateCreate.js"
import { directoryAdminUsersProductionStateCreate } from "./directoryAdminUsersProductionStateCreate.js"

/** Production mount for the users screen: session-bound adapter, dialogs, and shared view. */
export function DirectoryAdminUsersProductionAdapter() {
  const screen = directoryAdminUsersProductionStateCreate()
  const dialogs = directoryAdminUsersDialogsStateCreate({ page: screen.page })
  const state: DirectoryAdminUsersViewState = {
    basePath: screen.basePath,
    confirmState: screen.confirmState,
    dialogs,
    navigateProfile: (userId: string) => screen.navigate(`${screen.basePath}/users/${userId}`),
    page: screen.page,
  }
  return <DirectoryAdminUsersView state={state} />
}

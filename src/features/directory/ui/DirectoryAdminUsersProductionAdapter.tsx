import type { DirectoryAdminUsersViewState } from "./DirectoryAdminUsersView.js"
import { DirectoryAdminUsersView } from "./DirectoryAdminUsersView.js"
import { directoryAdminUsersDialogsStateCreate } from "./directoryAdminUsersDialogsStateCreate.js"
import { directoryAdminUsersProductionStateCreate } from "./directoryAdminUsersProductionStateCreate.js"

/** Production mount for the users screen: session-bound adapter, dialogs, and shared view. */
export function DirectoryAdminUsersProductionAdapter() {
  const screen = directoryAdminUsersProductionStateCreate()
  const dialogs = directoryAdminUsersDialogsStateCreate({ page: screen.page, teams: screen.teams })
  const state: DirectoryAdminUsersViewState = {
    basePath: screen.basePath,
    confirmState: screen.confirmState,
    dialogs,
    page: screen.page,
    teams: screen.teams,
    teamsDialogs: screen.teamsDialogs,
  }
  return <DirectoryAdminUsersView state={state} />
}

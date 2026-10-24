import { useNavigate } from "@solidjs/router"
import type { DirectoryAdminUsersViewState } from "./DirectoryAdminUsersView.js"
import { DirectoryAdminUsersView } from "./DirectoryAdminUsersView.js"
import { directoryAdminUsersDemoStateCreate } from "./directoryAdminUsersDemoStateCreate.js"
import { directoryAdminUsersDialogsStateCreate } from "./directoryAdminUsersDialogsStateCreate.js"

/** Demo mount for the users screen: fixture adapter honouring `?as=` plus the shared view. */
export function DirectoryAdminUsersDemoAdapter() {
  const screen = directoryAdminUsersDemoStateCreate()
  const navigate = useNavigate()
  const dialogs = directoryAdminUsersDialogsStateCreate({ page: screen.page })
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
      <DirectoryAdminUsersView state={state} />
    </div>
  )
}

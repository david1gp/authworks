import { DirectoryRealmAdministratorsView } from "./DirectoryRealmAdministratorsView.js"
import { directoryRealmAdministratorsDemoStateCreate } from "./directoryRealmAdministratorsDemoStateCreate.js"

/** Demo mount for the realm administrators screen: fixture adapter plus shared view. */
export function DirectoryRealmAdministratorsDemoAdapter() {
  const screen = directoryRealmAdministratorsDemoStateCreate()
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <DirectoryRealmAdministratorsView state={{ confirmState: screen.confirmState, view: screen.view }} />
    </div>
  )
}

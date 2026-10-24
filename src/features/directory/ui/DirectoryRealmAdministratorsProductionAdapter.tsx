import { DirectoryRealmAdministratorsView } from "./DirectoryRealmAdministratorsView.js"
import { directoryRealmAdministratorsProductionStateCreate } from "./directoryRealmAdministratorsProductionStateCreate.js"

/** Production mount for the realm administrators screen: session-bound adapter plus shared view. */
export function DirectoryRealmAdministratorsProductionAdapter() {
  const screen = directoryRealmAdministratorsProductionStateCreate()
  return <DirectoryRealmAdministratorsView state={{ confirmState: screen.confirmState, view: screen.view }} />
}

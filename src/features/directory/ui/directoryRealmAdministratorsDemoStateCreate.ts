import { useLocation, useNavigate } from "@solidjs/router"
import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { directoryRealmAdministratorsDemoAdapterCreate } from "./directoryRealmAdministratorsDemoAdapterCreate.js"
import { directoryRealmAdministratorsPageStateCreate } from "./directoryRealmAdministratorsPageStateCreate.js"
import { directoryRealmAdministratorsViewStateCreate } from "./directoryRealmAdministratorsViewStateCreate.js"

/** Binds the realm administrators screen to deterministic fixtures honouring `?state=`. */
export function directoryRealmAdministratorsDemoStateCreate() {
  const location = useLocation()
  const navigate = useNavigate()
  const confirmState = confirmStateCreate()
  const fixtureState = () =>
    demoFixtureStateSelect(location.search, ["success", "empty", "loading", "error", "permission-denied"])
  const adapter = directoryRealmAdministratorsDemoAdapterCreate(fixtureState)
  const page = directoryRealmAdministratorsPageStateCreate({
    adapter,
    cacheKey: () => "authworks.admin.realmAdministrators.demo.01900000-0000-7000-8000-000000000001",
    confirm: confirmState.confirm,
    realmId: "01900000-0000-7000-8000-000000000001",
    reloadKey: fixtureState,
    search: () => location.search,
  })
  const view = directoryRealmAdministratorsViewStateCreate({
    navigate: (href, options) => navigate(href, options),
    page,
    search: () => location.search,
  })
  const stateOptions = () =>
    (["success", "empty", "loading", "error", "permission-denied"] as const).map((fixture: DemoFixtureState) => ({
      href: demoFixtureScenarioHrefBuild("/demo/admin/realm/administrators", fixture),
      label: fixture,
      selected: fixture === fixtureState(),
    }))

  return { confirmState, fixtureState, page, stateOptions, view }
}

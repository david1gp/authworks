import { useLocation } from "@solidjs/router"
import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import { adminDemoAccessSelect } from "../../admin/ui/adminDemoAppStateCreate.js"
import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { directoryAdminDemoAdapterCreate } from "./directoryAdminDemoAdapterCreate.js"
import { directoryAdminUsersPageStateCreate } from "./directoryAdminUsersPageStateCreate.js"

/** Binds the users page to network-free demo fixtures honouring `?as=` and all URL params. */
export function directoryAdminUsersDemoStateCreate() {
  const location = useLocation()
  const confirmState = confirmStateCreate()
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAdminScenarioGroups)
  const fixtureState = () => demoFixtureStateSelect(location.search, scenario()?.states ?? ["success"])
  const demoAccess = () => {
    const access = adminDemoAccessSelect(location.search)
    return access === "realm-admin" ? "realm-admin" : access
  }
  const adapter = directoryAdminDemoAdapterCreate(fixtureState, demoAccess)
  const page = directoryAdminUsersPageStateCreate({
    adapter,
    confirm: confirmState.confirm,
    organizationId: "01900000-0000-7000-8000-000000000011",
    realmAdministrator: demoAccess() === "realm-admin",
    realmId: "01900000-0000-7000-8000-000000000001",
    reloadKey: fixtureState,
    search: () => location.search,
  })
  return {
    basePath: "/demo/admin",
    confirmState,
    fixtureState,
    page,
    realmAdministrator: () => demoAccess() === "realm-admin",
  }
}

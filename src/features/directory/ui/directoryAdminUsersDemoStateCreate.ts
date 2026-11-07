import { useLocation, useNavigate } from "@solidjs/router"
import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import { adminDemoAccessSelect } from "../../admin/ui/adminDemoAppStateCreate.js"
import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { directoryAdminDemoAdapterCreate } from "./directoryAdminDemoAdapterCreate.js"
import { directoryAdminDemoDirectoryStoreCreate } from "./directoryAdminDemoDirectoryStoreCreate.js"
import { directoryAdminUsersPageStateCreate } from "./directoryAdminUsersPageStateCreate.js"
import { directoryTeamsDemoAdapterCreate } from "./directoryTeamsDemoAdapterCreate.js"
import { directoryTeamsDialogsStateCreate } from "./directoryTeamsDialogsStateCreate.js"
import { directoryTeamsPageStateCreate } from "./directoryTeamsPageStateCreate.js"

/** Binds the users page to network-free demo fixtures honouring `?as=` and all URL params. */
export function directoryAdminUsersDemoStateCreate() {
  const location = useLocation()
  const navigate = useNavigate()
  const confirmState = confirmStateCreate()
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAdminScenarioGroups)
  const fixtureState = () => demoFixtureStateSelect(location.search, scenario()?.states ?? ["success"])
  const demoAccess = () => {
    const access = adminDemoAccessSelect(location.search)
    return access === "realm-admin" ? "realm-admin" : access
  }
  // One store shared by the users and teams adapters so assignments stay
  // visible on both the People and Teams tabs.
  const store = directoryAdminDemoDirectoryStoreCreate()
  const adapter = directoryAdminDemoAdapterCreate(fixtureState, demoAccess, store)
  const page = directoryAdminUsersPageStateCreate({
    adapter,
    confirm: confirmState.confirm,
    invitationDemo: true,
    invitationOrigin: window.location.origin,
    organizationId: () => "01900000-0000-7000-8000-000000000011",
    realmAdministrator: () => demoAccess() === "realm-admin",
    realmId: () => "01900000-0000-7000-8000-000000000001",
    reloadKey: fixtureState,
    search: () => location.search,
  })
  const teams = directoryTeamsPageStateCreate({
    actorUserId: () => undefined,
    adapter: directoryTeamsDemoAdapterCreate(store, fixtureState),
    canManageAll: () => true,
    confirm: confirmState.confirm,
    organizationId: () => "01900000-0000-7000-8000-000000000011",
    realmId: () => "01900000-0000-7000-8000-000000000001",
    reloadKey: fixtureState,
    search: () => location.search,
  })
  const teamsDialogs = directoryTeamsDialogsStateCreate({ page: teams })
  return {
    basePath: "/demo/admin",
    confirmState,
    fixtureState,
    navigate,
    page,
    realmAdministrator: () => demoAccess() === "realm-admin",
    teams,
    teamsDialogs,
  }
}

import { useLocation } from "@solidjs/router"
import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import { adminDemoAccessSelect } from "../../admin/ui/adminDemoAppStateCreate.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { directoryRolesDemoAdapterCreate } from "./directoryRolesDemoAdapterCreate.js"
import { directoryRolesPageStateCreate } from "./directoryRolesPageStateCreate.js"
import { directoryRolesViewStateCreate } from "./directoryRolesViewStateCreate.js"

const activeOrganizationId = "01900000-0000-7000-8000-000000000011"

/** Binds the roles screen to deterministic fixtures, honouring `?as=` and `?state=`. */
export function directoryRolesDemoStateCreate() {
  const location = useLocation()
  const access = () => adminDemoAccessSelect(location.search)
  const fixtureState = () =>
    demoFixtureStateSelect(location.search, ["success", "empty", "loading", "error", "permission-denied"])
  const adapter = directoryRolesDemoAdapterCreate(fixtureState)
  const confirmState = confirmStateCreate()
  const organizationId = () => activeOrganizationId
  const page = directoryRolesPageStateCreate({
    adapter,
    cacheKey: () => `authworks.admin.roles.demo.${activeOrganizationId}.${access()}`,
    canManage: () => access() === "owner" || access() === "admin" || access() === "realm-admin",
    confirm: confirmState.confirm,
    organizationId,
  })
  const view = directoryRolesViewStateCreate({
    asParam: () => (access() === "realm-admin" ? undefined : access()),
    basePath: "/demo/admin",
    page,
  })

  const stateOptions = () =>
    (["success", "empty", "loading", "error", "permission-denied"] as const).map((fixture: DemoFixtureState) => ({
      href: demoFixtureScenarioHrefBuild(`/demo/admin/roles?as=${access()}`, fixture),
      label: fixture,
      selected: fixture === fixtureState(),
    }))

  return { access, confirmState, fixtureState, stateOptions, view }
}

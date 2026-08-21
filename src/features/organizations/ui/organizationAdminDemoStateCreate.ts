import { useLocation, useParams } from "@solidjs/router"
import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { organizationAdminDemoAdapterCreate } from "./organizationAdminDemoAdapterCreate.js"
import { organizationAdminPageStateCreate } from "./organizationAdminPageStateCreate.js"
import { organizationAdminScreenStateCreate } from "./organizationAdminScreenStateCreate.js"
import type { OrganizationAdminScreen } from "./organizationAdminScreenSchema.js"

const demoOrganizationId = "01900000-0000-7000-8000-000000000011"

/** Binds the organization administration screens to network-free, URL-selectable demo fixtures. */
export function organizationAdminDemoStateCreate(screen: () => OrganizationAdminScreen) {
  const location = useLocation()
  const params = useParams<{ organizationId?: string }>()
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAdminScenarioGroups)
  const fixtureState = () => demoFixtureStateSelect(location.search, scenario()?.states ?? ["success"])
  const organizationId = () => params.organizationId ?? demoOrganizationId
  const adapter = organizationAdminDemoAdapterCreate(fixtureState)
  // The demo keeps the real confirmation prompts so destructive flows stay faithful to production.
  const page = organizationAdminPageStateCreate({ adapter, organizationId, screen })
  const screenState = organizationAdminScreenStateCreate({ basePath: "/demo/admin", page })

  return {
    ...screenState,
    stateOptions: () =>
      (scenario()?.states ?? ["success"]).map((state) => ({
        href: demoFixtureScenarioHrefBuild(location.pathname, state),
        label: state,
        selected: state === fixtureState(),
      })),
  }
}

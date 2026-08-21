import { useLocation, useNavigate, useParams } from "@solidjs/router"
import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { adminDemoAdapterCreate } from "./adminDemoAdapterCreate.js"
import { adminPageStateCreate } from "./adminPageStateCreate.js"
import type { AdminScreen } from "./adminScreenSchema.js"

export function adminDemoStateCreate(screen: () => AdminScreen) {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams<{ userId?: string }>()
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAdminScenarioGroups)
  const fixtureState = () => demoFixtureStateSelect(location.search, scenario()?.states ?? ["success"])
  const adapter = adminDemoAdapterCreate(fixtureState, { signedInInitially: screen() !== "sign-in" })
  const page = adminPageStateCreate({
    adapter,
    // Destructive fixture confirmations stay explicit but never block the deterministic demo.
    confirm: () => true,
    reloadKey: fixtureState,
    screen,
    search: () => new URLSearchParams(location.search).get("q") ?? "",
    searchSet: (value: string) => {
      const search = new URLSearchParams(location.search)
      if (value.length === 0) search.delete("q")
      else search.set("q", value)
      const encoded = search.toString()
      navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
    },
    userId: () => params.userId,
  })

  return {
    ...page,
    scenario,
    stateOptions: () =>
      (scenario()?.states ?? ["success"]).map((option) => ({
        href: demoFixtureScenarioHrefBuild(location.pathname, option),
        label: option,
        selected: option === fixtureState(),
      })),
  }
}

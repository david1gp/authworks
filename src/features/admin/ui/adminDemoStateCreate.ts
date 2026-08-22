import { useLocation, useNavigate, useParams } from "@solidjs/router"
import { englishCatalog } from "../../../ui/i18n/model/englishCatalog.js"
import { i18nStore } from "../../../ui/i18n/model/i18nStore.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
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
    reloadKey: () => `${fixtureState()}:${i18nStore.language.get()}`,
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
    realm: () => {
      const realm = page.realm()
      if (realm === undefined || realm.name !== englishCatalog["demo.admin.realmFixtureName"]) return realm
      return { ...realm, name: messageTranslate("demo.admin.realmFixtureName") }
    },
    scenario,
    scenarioDescription: () =>
      screen() === "overview"
        ? messageTranslate("admin.overview.description")
        : (scenario()?.description ?? messageTranslate("demo.admin.eyebrow")),
    scenarioTitle: () =>
      screen() === "overview"
        ? messageTranslate("admin.overview.title")
        : (scenario()?.title ?? messageTranslate("admin.navigation.label")),
    stateOptions: () =>
      (scenario()?.states ?? ["success"]).map((option) => ({
        href: demoFixtureScenarioHrefBuild(location.pathname, option),
        label:
          option === "success" || option === "loading" || option === "error" || option === "expired"
            ? messageTranslate(`demo.fixture.${option}`)
            : option,
        selected: option === fixtureState(),
      })),
  }
}

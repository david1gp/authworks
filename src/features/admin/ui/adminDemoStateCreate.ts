import { useLocation, useNavigate, useParams } from "@solidjs/router"
import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import { englishCatalog } from "../../../ui/i18n/model/englishCatalog.js"
import { i18nStore } from "../../../ui/i18n/model/i18nStore.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { demoFixtureStateLabel } from "../../demo/public/demoFixtureStateLabel.js"
import { adminDemoAdapterCreate } from "./adminDemoAdapterCreate.js"
import { adminPageStateCreate } from "./adminPageStateCreate.js"
import type { AdminScreen } from "./adminScreenSchema.js"

function adminDemoScenarioKeyResolve(screen: AdminScreen, pathname: string): string {
  if (screen === "user-detail") {
    if (pathname.endsWith("/authentication")) return "user-authentication"
    if (pathname.endsWith("/sessions")) return "user-sessions"
    return "user-detail"
  }
  switch (screen) {
    case "sign-in":
      return "admin-sign-in"
    case "overview":
      return "realm-overview"
    case "realm":
      return "realm-settings"
    case "users":
      return "users"
    case "sessions":
      return "sessions"
    case "audit-events":
      return "audit-events"
  }
}

function adminDemoScenarioMessageKeyGet(scenarioKey: string, kind: "title" | "description"): MessageKey | undefined {
  const normalized = scenarioKey.replaceAll("-", "_")
  const candidate = `demo.admin.scenario.${normalized}.${kind}` as MessageKey
  return candidate in englishCatalog ? candidate : undefined
}

export function adminDemoStateCreate(screen: () => AdminScreen) {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams<{ userId?: string }>()
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAdminScenarioGroups)
  const fixtureState = () => demoFixtureStateSelect(location.search, scenario()?.states ?? ["success"])
  const adapter = adminDemoAdapterCreate(fixtureState, { signedInInitially: screen() !== "sign-in" })
  const confirmState = confirmStateCreate()
  const page = adminPageStateCreate({
    adapter,
    // Every guarded administration action is answered by the same visible, cancelable dialog.
    confirm: confirmState.confirm,
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
    confirmState,
    realm: () => {
      const realm = page.realm()
      if (realm === undefined || realm.name !== englishCatalog["demo.admin.realmFixtureName"]) return realm
      return { ...realm, name: messageTranslate("demo.admin.realmFixtureName") }
    },
    scenario,
    scenarioDescription: () => {
      const key = scenario()?.key ?? adminDemoScenarioKeyResolve(screen(), location.pathname)
      const messageKey = adminDemoScenarioMessageKeyGet(key, "description")
      return messageKey !== undefined ? messageTranslate(messageKey) : messageTranslate("demo.admin.eyebrow")
    },
    scenarioTitle: () => {
      const key = scenario()?.key ?? adminDemoScenarioKeyResolve(screen(), location.pathname)
      const messageKey = adminDemoScenarioMessageKeyGet(key, "title")
      return messageKey !== undefined ? messageTranslate(messageKey) : messageTranslate("admin.navigation.label")
    },
    stateOptions: () =>
      (scenario()?.states ?? ["success"]).map((option) => ({
        href: demoFixtureScenarioHrefBuild(location.pathname, option),
        label: demoFixtureStateLabel(option),
        selected: option === fixtureState(),
      })),
  }
}

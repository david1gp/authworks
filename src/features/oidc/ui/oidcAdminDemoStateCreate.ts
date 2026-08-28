import { useLocation } from "@solidjs/router"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { demoAdminOidcClientSecret } from "../../demo/demoAdminOidcClientSecret.js"
import { demoAdminOidcClients } from "../../demo/demoAdminOidcClients.js"
import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { demoAdminScenarioMessageKeyGet } from "../../demo/public/demoAdminScenarioMessageKeyGet.js"
import { demoFixtureStateLabel } from "../../demo/public/demoFixtureStateLabel.js"
import { oidcAdminDemoAdapterCreate } from "./oidcAdminDemoAdapterCreate.js"
import { oidcAdminDemoIssuedSecretSeedSelect } from "./oidcAdminDemoIssuedSecretSeedSelect.js"
import type { OidcAdminScreen } from "./oidcAdminScreenSchema.js"
import { oidcAdminScreenStateCreate } from "./oidcAdminScreenStateCreate.js"
import { oidcAdminSecretAcknowledgementStore } from "./oidcAdminSecretAcknowledgementStore.js"

export function oidcAdminDemoStateCreate(options: {
  readonly clientId: () => string | undefined
  readonly screen: () => OidcAdminScreen
}) {
  const location = useLocation()
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAdminScenarioGroups)
  const fixtureState = () => demoFixtureStateSelect(location.search, scenario()?.states ?? ["success"])

  // The one-time state is reachable straight from a URL, so it seeds an already-issued
  // secret instead of requiring the operator to run a mutation first. Once acknowledged it
  // must not reappear on reload, so the acknowledgement is remembered for this session.
  const issuedSecretSeed = () => {
    if (fixtureState() !== "one-time") return undefined
    // A deep link to one client must show that client's secret, never the first client's.
    const seeded = oidcAdminDemoIssuedSecretSeedSelect({
      clientId: options.clientId(),
      clients: demoAdminOidcClients,
      secret: demoAdminOidcClientSecret,
    })
    if (seeded === undefined) return undefined
    const marker = oidcAdminSecretAcknowledgementStore.markerBuild(seeded.clientId, seeded.kind)
    return oidcAdminSecretAcknowledgementStore.acknowledged(marker) ? undefined : seeded
  }

  const screenState = oidcAdminScreenStateCreate({
    adapter: oidcAdminDemoAdapterCreate(fixtureState),
    basePath: "/demo/admin",
    clientId: options.clientId,
    issuedSecretSeed,
    onIssuedSecretAcknowledge: (issued) =>
      oidcAdminSecretAcknowledgementStore.acknowledge(
        oidcAdminSecretAcknowledgementStore.markerBuild(issued.clientId, issued.kind),
      ),
    screen: options.screen,
  })

  // The demo header is translated through the scenario catalog rather than the fixture group metadata.
  const scenarioMessage = (kind: "description" | "title") => {
    const key = scenario()?.key
    return key === undefined ? undefined : demoAdminScenarioMessageKeyGet(key, kind)
  }

  return {
    ...screenState,
    fixtureState,
    scenarioDescription: () => {
      const key = scenarioMessage("description")
      return key === undefined ? messageTranslate("demo.admin.eyebrow") : messageTranslate(key)
    },
    scenarioTitle: () => {
      const key = scenarioMessage("title")
      return key === undefined ? messageTranslate("admin.oidc.clients.title") : messageTranslate(key)
    },
    stateOptions: () =>
      (scenario()?.states ?? ["success"]).map((state) => ({
        href: demoFixtureScenarioHrefBuild(location.pathname, state),
        label: demoFixtureStateLabel(state),
        selected: state === fixtureState(),
      })),
  }
}

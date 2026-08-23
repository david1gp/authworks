import { useLocation } from "@solidjs/router"
import { demoAdminOidcClientSecret } from "../../demo/demoAdminOidcClientSecret.js"
import { demoAdminOidcClients } from "../../demo/demoAdminOidcClients.js"
import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateLabel } from "../../demo/public/demoFixtureStateLabel.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
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

  return {
    ...screenState,
    fixtureState,
    stateOptions: () =>
      (scenario()?.states ?? ["success"]).map((state) => ({
        href: demoFixtureScenarioHrefBuild(location.pathname, state),
        label: demoFixtureStateLabel(state),
        selected: state === fixtureState(),
      })),
  }
}

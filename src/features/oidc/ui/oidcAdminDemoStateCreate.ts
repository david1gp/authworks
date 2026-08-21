import { useLocation } from "@solidjs/router"
import { demoAdminOidcClientSecret } from "../../demo/demoAdminOidcClientSecret.js"
import { demoAdminOidcClients } from "../../demo/demoAdminOidcClients.js"
import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { oidcAdminDemoAdapterCreate } from "./oidcAdminDemoAdapterCreate.js"
import { oidcAdminScreenStateCreate } from "./oidcAdminScreenStateCreate.js"
import type { OidcAdminScreen } from "./oidcAdminScreenSchema.js"

export function oidcAdminDemoStateCreate(options: {
  readonly clientId: () => string | undefined
  readonly screen: () => OidcAdminScreen
}) {
  const location = useLocation()
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAdminScenarioGroups)
  const fixtureState = () => demoFixtureStateSelect(location.search, scenario()?.states ?? ["success"])

  // The one-time state is reachable straight from a URL, so it seeds an already-issued
  // secret instead of requiring the operator to run a mutation first.
  const issuedSecretSeed = () =>
    fixtureState() === "one-time"
      ? {
          clientId: demoAdminOidcClients[0]?.id ?? "",
          clientName: demoAdminOidcClients[0]?.name ?? "",
          kind: "rotated" as const,
          secret: demoAdminOidcClientSecret,
        }
      : undefined

  const screenState = oidcAdminScreenStateCreate({
    adapter: oidcAdminDemoAdapterCreate(fixtureState),
    basePath: "/demo/admin",
    clientId: options.clientId,
    issuedSecretSeed,
    // Demo destinations stay network-free and non-blocking, so confirmations auto-accept.
    confirm: () => true,
    screen: options.screen,
  })

  return {
    ...screenState,
    fixtureState,
    stateOptions: () =>
      (scenario()?.states ?? ["success"]).map((state) => ({
        href: demoFixtureScenarioHrefBuild(location.pathname, state),
        label: state,
        selected: state === fixtureState(),
      })),
  }
}

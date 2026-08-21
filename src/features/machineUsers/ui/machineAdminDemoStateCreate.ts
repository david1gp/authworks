import { useLocation } from "@solidjs/router"
import { demoAdminMachineSecret } from "../../demo/demoAdminMachineSecret.js"
import { demoAdminMachineUsers } from "../../demo/demoAdminMachineUsers.js"
import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { machineAdminDemoAdapterCreate } from "./machineAdminDemoAdapterCreate.js"
import { machineAdminScreenStateCreate } from "./machineAdminScreenStateCreate.js"
import type { MachineAdminScreen } from "./machineAdminScreenSchema.js"

/** The fixed "now" the credential fixtures are authored against, so expiry is deterministic. */
const demoNow = 1_755_782_400_000

export function machineAdminDemoStateCreate(options: {
  readonly machineUserId: () => string | undefined
  readonly screen: () => MachineAdminScreen
}) {
  const location = useLocation()
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAdminScenarioGroups)
  const fixtureState = () => demoFixtureStateSelect(location.search, scenario()?.states ?? ["success"])

  // The one-time state is reachable straight from a URL, so it seeds an already-issued
  // secret instead of requiring the operator to run a mutation first.
  const issuedSecretSeed = () =>
    fixtureState() === "one-time"
      ? {
          clientId: demoAdminMachineUsers[0]?.userName ?? "",
          kind: "client_secret" as const,
          machineUserName: demoAdminMachineUsers[0]?.displayName ?? "",
          name: demoAdminMachineUsers[0]?.displayName ?? "",
          secret: demoAdminMachineSecret,
        }
      : undefined

  const screenState = machineAdminScreenStateCreate({
    adapter: machineAdminDemoAdapterCreate(fixtureState),
    basePath: "/demo/admin",
    // Demo destinations stay network-free and non-blocking, so confirmations auto-accept.
    confirm: () => true,
    issuedSecretSeed,
    machineUserId: options.machineUserId,
    now: () => demoNow,
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
